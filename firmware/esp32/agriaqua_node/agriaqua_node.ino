// AgriAqua 360 — ESP32 field / pond / controller node.
// Sends readings to the AgriAqua `ingest` endpoint over HTTPS (or MQTT), receives pump/aerator/valve commands.
// Setup: firmware/esp32/README.md. Board: "ESP32 Dev Module" (Arduino-ESP32 core 3.x).
// Libraries: ArduinoJson 7, OneWire, DallasTemperature, DHT sensor library, BH1750, PubSubClient (MQTT only).
//
// RULES THIS FIRMWARE FOLLOWS
//  * Only sensors enabled below are reported; the app rejects channels the device was not registered with.
//  * A relay never runs longer than MAX_RUN_S[ch], even if the network drops after an ON command.
//  * The local manual switch always wins over remote commands, and its state is reported to the app.
//  * Readings are buffered with their real timestamps while Wi-Fi is down and sent later.

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>
#include "secrets.h"   // copy secrets.example.h → secrets.h (never commit secrets.h)

// ---------------- Which sensors are physically connected (1 = yes) ----------------
#define HAS_SOIL_MOISTURE 0   // capacitive soil moisture v1.2 on SOIL_PIN (analog)
#define HAS_DS18B20       0   // waterproof DS18B20 on ONEWIRE_PIN → water_temp or soil_temp (see DS18B20_TYPE)
#define HAS_DHT22         0   // DHT22 on DHT_PIN → air_temp, air_humidity
#define HAS_PH            0   // analog pH board (e.g. DFRobot SEN0161-V2) on PH_PIN → water_ph or soil_ph (PH_TYPE)
#define HAS_DO            0   // analog DO probe (e.g. DFRobot SEN0237) on DO_PIN → water_do
#define HAS_TURBIDITY     0   // analog turbidity (e.g. DFRobot SEN0189) on TURB_PIN → turbidity (NTU)
#define HAS_LEVEL         0   // JSN-SR04T ultrasonic above the water → water_level (cm of water)
#define HAS_LIGHT         0   // BH1750 on I2C → light (lux)
#define HAS_RAIN          0   // tipping-bucket rain gauge reed switch on RAIN_PIN → rainfall (mm per report)
#define HAS_BATTERY       1   // battery via 100k/100k divider on BAT_PIN → battery (%)
// Ammonia and salinity probes differ a lot between vendors; add their read code in readAmmonia()/readSalinity()
// and set these to 1 only when a real probe is wired.
#define HAS_AMMONIA       0
#define HAS_SALINITY      0

// ---------------- Relays (controller nodes) ----------------
#define RELAY_COUNT 0                                   // 0..4
const char* RELAY_CH[]   = {"pump1", "aerator1", "valve1", "feeder1"}; // must match channel names registered in the app
const int   RELAY_PIN[]  = {26, 27, 14, 32};            // avoid strapping pins (0, 2, 12, 15) for relays
const int   MANUAL_PIN[] = {13, 23, 16, 17};            // manual switch inputs (LOW = manual ON), -1 if none; not 34-39 (no pull-ups)
const uint32_t MAX_RUN_S[] = {1800, 3600, 1800, 600};   // hard limit on the board, same or lower than in the app
const bool  RELAY_ACTIVE_LOW = true;

// ---------------- Pins & calibration ----------------
#define SOIL_PIN 36
#define ONEWIRE_PIN 4
#define DS18B20_TYPE "water_temp"   // or "soil_temp"
#define DHT_PIN 15
#define PH_PIN 39
#define PH_TYPE "water_ph"          // or "soil_ph"
#define DO_PIN 34
#define TURB_PIN 35
#define LEVEL_TRIG 18
#define LEVEL_ECHO 19
#define LEVEL_SENSOR_HEIGHT_CM 200.0 // sensor face height above pond bottom
#define RAIN_PIN 25
#define RAIN_MM_PER_TIP 0.2794
#define BAT_PIN 33
const int SOIL_DRY = 3000, SOIL_WET = 1200;   // raw ADC in air / in water — measure yours
// Calibration of pH/DO/turbidity is done in the app (offset/scale per channel), so firmware sends raw-ish units.

#if HAS_DS18B20
#include <OneWire.h>
#include <DallasTemperature.h>
OneWire oneWire(ONEWIRE_PIN); DallasTemperature ds(&oneWire);
#endif
#if HAS_DHT22
#include <DHT.h>
DHT dht(DHT_PIN, DHT22);
#endif
#if HAS_LIGHT
#include <Wire.h>
#include <BH1750.h>
BH1750 lightMeter;
#endif
#if USE_MQTT
#include <PubSubClient.h>
WiFiClientSecure mqttNet; PubSubClient mqtt(mqttNet);
#endif

// ---------------- Offline buffer ----------------
struct Reading { char ch[16]; float v; uint32_t t; };
const int BUF_MAX = 600;            // ~ a day of 8 channels at 15 min
Reading buf[BUF_MAX]; int bufHead = 0, bufCount = 0;
void push(const char* ch, float v) {
  if (isnan(v)) return;             // a failed read is never sent as a number
  Reading& r = buf[(bufHead + bufCount) % BUF_MAX];
  strncpy(r.ch, ch, sizeof(r.ch) - 1); r.ch[sizeof(r.ch) - 1] = 0; r.v = v; r.t = time(nullptr);
  if (bufCount < BUF_MAX) bufCount++; else bufHead = (bufHead + 1) % BUF_MAX;   // drop oldest when full
}

// ---------------- Relays ----------------
uint32_t relayOffAt[4] = {0, 0, 0, 0};
bool relayOn[4] = {false, false, false, false};
void setRelay(int i, bool on, uint32_t seconds) {
  if (on) seconds = min(seconds, MAX_RUN_S[i]);
  relayOn[i] = on;
  relayOffAt[i] = on ? millis() + seconds * 1000UL : 0;
  digitalWrite(RELAY_PIN[i], (on ^ RELAY_ACTIVE_LOW) ? HIGH : LOW);
}
bool manualOn(int i) { return MANUAL_PIN[i] >= 0 && digitalRead(MANUAL_PIN[i]) == LOW; }
void relayLoop() {
  for (int i = 0; i < RELAY_COUNT; i++) {
    if (manualOn(i)) { digitalWrite(RELAY_PIN[i], RELAY_ACTIVE_LOW ? LOW : HIGH); relayOn[i] = true; relayOffAt[i] = 0; continue; }
    if (relayOn[i] && relayOffAt[i] && (int32_t)(millis() - relayOffAt[i]) >= 0) setRelay(i, false, 0);   // max run reached
    if (relayOn[i] && !relayOffAt[i] && !manualOn(i)) setRelay(i, false, 0);  // manual switch released
  }
}

// ---------------- Sensors ----------------
volatile uint32_t rainTips = 0;
void IRAM_ATTR onRainTip() { static uint32_t last = 0; uint32_t n = millis(); if (n - last > 200) { rainTips++; last = n; } }
float analogVolts(int pin, int samples = 20) { uint32_t s = 0; for (int i = 0; i < samples; i++) { s += analogReadMilliVolts(pin); delay(5); } return s / (float)samples / 1000.0; }
float readAmmonia() { return NAN; }   // add your probe's code
float readSalinity() { return NAN; }  // add your probe's code

void readSensors() {
#if HAS_SOIL_MOISTURE
  { int raw = analogRead(SOIL_PIN); push("soil_moisture", constrain(100.0 * (SOIL_DRY - raw) / (SOIL_DRY - SOIL_WET), 0, 100)); }
#endif
  [[maybe_unused]] float waterTemp = 25.0;   // used for DO temperature compensation
#if HAS_DS18B20
  ds.requestTemperatures(); { float t = ds.getTempCByIndex(0); if (t > -100 && t < 85) { push(DS18B20_TYPE, t); waterTemp = t; } }
#endif
#if HAS_DHT22
  push("air_temp", dht.readTemperature()); push("air_humidity", dht.readHumidity());
#endif
#if HAS_PH
  push(PH_TYPE, 7.0 + (2.5 - analogVolts(PH_PIN)) / 0.18);   // generic slope; fine-tune with the app's 2-point calibration
#endif
#if HAS_DO
  { // DFRobot single-point method: saturation voltage at calibration temperature (set DO_CAL_MV from your calibration)
    const float DO_CAL_MV = 1600.0, DO_CAL_T = 25.0;
    static const float SAT[41] = {14.46,14.22,13.82,13.44,13.09,12.74,12.42,12.11,11.81,11.53,11.26,11.01,10.77,10.53,10.30,10.08,9.86,9.66,9.46,9.27,9.08,8.90,8.73,8.57,8.41,8.25,8.11,7.96,7.82,7.69,7.56,7.43,7.30,7.18,7.07,6.95,6.84,6.73,6.63,6.53,6.41};
    int ti = constrain((int)waterTemp, 0, 40);
    float vSat = DO_CAL_MV + 35.0 * (waterTemp - DO_CAL_T);
    push("water_do", analogVolts(DO_PIN) * 1000.0 * SAT[ti] / vSat);
  }
#endif
#if HAS_TURBIDITY
  { float v = analogVolts(TURB_PIN) * 1.5; float ntu = v >= 4.2 ? 0 : -1120.4 * v * v + 5742.3 * v - 4352.9; push("turbidity", max(ntu, 0.0f)); }  // 3.3→5V divider assumed
#endif
#if HAS_LEVEL
  { digitalWrite(LEVEL_TRIG, LOW); delayMicroseconds(2); digitalWrite(LEVEL_TRIG, HIGH); delayMicroseconds(20); digitalWrite(LEVEL_TRIG, LOW);
    unsigned long us = pulseIn(LEVEL_ECHO, HIGH, 30000); if (us) push("water_level", LEVEL_SENSOR_HEIGHT_CM - us * 0.0343 / 2.0); }
#endif
#if HAS_LIGHT
  push("light", lightMeter.readLightLevel());
#endif
#if HAS_RAIN
  { noInterrupts(); uint32_t tips = rainTips; rainTips = 0; interrupts(); push("rainfall", tips * RAIN_MM_PER_TIP); }
#endif
#if HAS_AMMONIA
  push("ammonia", readAmmonia());
#endif
#if HAS_SALINITY
  push("salinity", readSalinity());
#endif
#if HAS_BATTERY
  push("battery", constrain((analogVolts(BAT_PIN) * 2.0 - 3.3) / (4.2 - 3.3) * 100.0, 0, 100));  // 1S Li-ion
#endif
}

// ---------------- Upload ----------------
String pendingAcks;   // JSON array body of acks for the next upload
String buildPayload(int& sent) {
  JsonDocument doc;
#if USE_MQTT
  doc["device_id"] = DEVICE_ID; doc["key"] = DEVICE_KEY;   // the broker rule forwards this to ingest
#endif
  JsonArray rs = doc["readings"].to<JsonArray>();
  sent = min(bufCount, 100);
  for (int i = 0; i < sent; i++) { Reading& r = buf[(bufHead + i) % BUF_MAX]; JsonObject o = rs.add<JsonObject>(); o["s"] = r.ch; o["v"] = r.v; if (r.t > 1700000000) o["t"] = r.t; }
  doc["rssi"] = WiFi.RSSI(); doc["fw"] = "agriaqua-1.0.0";
  JsonObject act = doc["actuators"].to<JsonObject>();
  for (int i = 0; i < RELAY_COUNT; i++) { JsonObject a = act[RELAY_CH[i]].to<JsonObject>(); a["state"] = relayOn[i] ? "on" : "off"; a["manual"] = manualOn(i); }
  if (pendingAcks.length()) { JsonDocument acks; deserializeJson(acks, pendingAcks); doc["acks"] = acks.as<JsonArray>(); }
  String out; serializeJson(doc, out); return out;
}

void handleCommands(JsonArray cmds) {
  JsonDocument acks; JsonArray arr = acks.to<JsonArray>();
  for (JsonObject c : cmds) {
    const char* ch = c["channel"]; const char* action = c["action"]; uint32_t dur = c["duration_s"] | 0;
    JsonObject a = arr.add<JsonObject>(); a["id"] = c["id"];
    int idx = -1; for (int i = 0; i < RELAY_COUNT; i++) if (strcmp(ch, RELAY_CH[i]) == 0) idx = i;
    if (idx < 0) { a["ok"] = false; a["msg"] = "unknown channel"; continue; }
    if (manualOn(idx)) { a["ok"] = false; a["msg"] = "manual switch in use"; continue; }
    bool on = strcmp(action, "on") == 0;
    setRelay(idx, on, dur);
    a["ok"] = true; a["msg"] = on ? String("on ") + min(dur, MAX_RUN_S[idx]) + "s" : "off";
  }
  pendingAcks = ""; if (arr.size()) serializeJson(acks, pendingAcks);
}

uint32_t intervalS = REPORT_INTERVAL_S;
bool uploadHttps() {
  int sent = 0; String body = buildPayload(sent);
  WiFiClientSecure net; net.setCACert(ROOT_CA);
  HTTPClient http; http.setTimeout(15000);
  if (!http.begin(net, INGEST_URL)) return false;
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-id", DEVICE_ID); http.addHeader("x-device-key", DEVICE_KEY);
  int code = http.POST(body);
  String resp = http.getString(); http.end();
  if (code != 200) { Serial.printf("ingest HTTP %d %s\n", code, resp.c_str()); return code == 401 ? true : false; }  // 401: wrong key — don't loop on it
  bufHead = (bufHead + sent) % BUF_MAX; bufCount -= sent; pendingAcks = "";
  JsonDocument doc; if (deserializeJson(doc, resp) == DeserializationError::Ok) {
    if (doc["interval_s"].is<int>()) intervalS = constrain((int)doc["interval_s"], 10, 86400);
    handleCommands(doc["commands"].as<JsonArray>());
  }
  return true;
}

#if USE_MQTT
bool uploadMqtt() {
  if (!mqtt.connected()) { mqttNet.setCACert(ROOT_CA); mqtt.setServer(MQTT_HOST, MQTT_PORT); mqtt.setBufferSize(8192);
    if (!mqtt.connect(DEVICE_ID, DEVICE_ID, DEVICE_KEY)) return false; }
  int sent = 0; String body = buildPayload(sent);
  String topic = String("agriaqua/") + DEVICE_ID + "/up";
  if (!mqtt.publish(topic.c_str(), body.c_str())) return false;
  bufHead = (bufHead + sent) % BUF_MAX; bufCount -= sent;
  return true;
}
#endif

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < RELAY_COUNT; i++) { pinMode(RELAY_PIN[i], OUTPUT); setRelay(i, false, 0); if (MANUAL_PIN[i] >= 0) pinMode(MANUAL_PIN[i], INPUT_PULLUP); }
#if HAS_DS18B20
  ds.begin();
#endif
#if HAS_DHT22
  dht.begin();
#endif
#if HAS_LIGHT
  Wire.begin(); lightMeter.begin();
#endif
#if HAS_LEVEL
  pinMode(LEVEL_TRIG, OUTPUT); pinMode(LEVEL_ECHO, INPUT);
#endif
#if HAS_RAIN
  pinMode(RAIN_PIN, INPUT_PULLUP); attachInterrupt(digitalPinToInterrupt(RAIN_PIN), onRainTip, FALLING);
#endif
  WiFi.mode(WIFI_STA); WiFi.begin(WIFI_SSID, WIFI_PASS);
  configTime(0, 0, "pool.ntp.org", "time.google.com");   // real timestamps for buffered readings
}

uint32_t lastRead = 0, lastUpload = 0;
void loop() {
  relayLoop();
#if USE_MQTT
  mqtt.loop();
#endif
  uint32_t now = millis();
  if (now - lastRead >= intervalS * 1000UL || lastRead == 0) { lastRead = now; readSensors(); }
  // Controllers check for commands every 10 s; sensor-only nodes upload once per interval.
  uint32_t uploadEvery = RELAY_COUNT ? 10000UL : intervalS * 1000UL;
  if (WiFi.status() == WL_CONNECTED && (now - lastUpload >= uploadEvery || lastUpload == 0)) {
    lastUpload = now;
#if USE_MQTT
    bool ok = RELAY_COUNT ? uploadHttps() : uploadMqtt();   // equipment commands always travel over HTTPS
#else
    bool ok = uploadHttps();
#endif
    if (!ok) Serial.println("upload failed, keeping readings in buffer");
  }
  delay(50);
}
