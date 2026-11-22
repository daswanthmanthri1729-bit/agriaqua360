# AgriAqua 360 — ESP32 sensor & controller node

One sketch (`agriaqua_node/agriaqua_node.ino`) works as a **field node**, **pond node**, **collar/animal node** or **equipment controller** (pump, aerator, valve, feeder). It sends readings to AgriAqua's `ingest` function and receives equipment commands in the reply.

```
ESP32 ──HTTPS──────────────────────────▶ Supabase Edge Function `ingest`
ESP32 ──MQTT/TLS──▶ EMQX Cloud ──HTTP rule──▶ `ingest`        (optional, sensor-only nodes)
                         ingest → Postgres (sensor_readings) → Realtime → app
```

> **Status:** the sketch is checked for syntax and type errors with every option on, but it has **not been flashed to real hardware** from this project yet. Check each sensor's readings against a reference meter before you trust them. Use the app's per-channel calibration for that.

## 1. Register the device in the app
**Monitor → Add device**:
1. Choose the type, link it to a farm, pond or animal, and tick the sensors that are **physically wired**.
2. The app shows a **Device ID** and **Device key once**. Copy them now. A lost key can be replaced with **Rotate key**.

Readings for a channel you did not tick are rejected. The app never assumes a sensor that isn't there.

## 2. Configure and flash
1. Install the Arduino IDE (2.x) and the "esp32 by Espressif" board package (core 3.x).
2. Install these libraries: ArduinoJson 7, OneWire, DallasTemperature, DHT sensor library (Adafruit), BH1750, and PubSubClient (MQTT only).
3. Copy `secrets.example.h` to `secrets.h` and fill in Wi-Fi, `DEVICE_ID`, `DEVICE_KEY` and the root certificate (see §5). `secrets.h` is gitignored.
4. In `agriaqua_node.ino`, set `HAS_…` to `1` for each wired sensor, and `RELAY_COUNT` for controllers.
5. Board **ESP32 Dev Module** → Upload. Then open Serial Monitor at 115200 baud.

## 3. Wiring (defaults; change the pin defines if needed)
| Sensor | Channel in app | Pin | Notes |
|---|---|---|---|
| Capacitive soil moisture v1.2 | `soil_moisture` (%) | GPIO36 (ADC1) | Set `SOIL_DRY`/`SOIL_WET` from readings in air and in water |
| DS18B20 waterproof | `water_temp` or `soil_temp` (°C) | GPIO4 + 4.7 kΩ pull-up | Choose with `DS18B20_TYPE` |
| DHT22 | `air_temp`, `air_humidity` | GPIO15 | |
| Analog pH board | `water_ph` or `soil_ph` | GPIO39 | Two-point calibration (pH 7 and 4) in the app |
| Analog DO probe (galvanic) | `water_do` (mg/L) | GPIO34 | Set `DO_CAL_MV` from the probe's saturation calibration |
| Analog turbidity | `turbidity` (NTU) | GPIO35 via divider | NTU from the vendor curve; verify against a reference |
| JSN-SR04T ultrasonic | `water_level` (cm) | TRIG 18, ECHO 19 | Mount above the water; set `LEVEL_SENSOR_HEIGHT_CM` |
| BH1750 | `light` (lux) | I²C SDA 21, SCL 22 | |
| Tipping-bucket rain gauge | `rainfall` (mm per report) | GPIO25 | `RAIN_MM_PER_TIP` from your gauge |
| Battery (1S Li-ion, 100k/100k divider) | `battery` (%) | GPIO33 | |
| Ammonia / salinity probe | `ammonia`, `salinity` | — | Vendor-specific: add code in `readAmmonia()` / `readSalinity()` |
| Relays (controller) | e.g. `pump1`, `aerator1` | GPIO26, 27, 14, 32 | Use opto-isolated relay or contactor modules rated for the motor |
| Manual switches | — | GPIO13, 23, 16, 17 (to GND) | Manual ON always overrides the app |

Use ADC1 pins (32–39) for analog sensors. ADC2 doesn't work while Wi-Fi is on.

**Electrical safety:** pumps and aerators run on mains or 3-phase power. Get a licensed electrician to fit a contactor driven by the relay, plus a motor overload protector. Never switch a motor directly with a small relay module.

## 4. What the board sends
`POST {INGEST_URL}` with headers `x-device-id` and `x-device-key`:
```json
{
  "readings": [{ "s": "water_do", "v": 6.4, "t": 1763800000 }],
  "battery": 88, "rssi": -67, "fw": "agriaqua-1.0.0",
  "actuators": { "aerator1": { "state": "off", "manual": false } },
  "acks": [{ "id": "<command id>", "ok": true, "msg": "on 900s" }],
  "location": { "lat": 16.5, "lon": 80.2, "acc": 8 }
}
```
- `s` is the channel name and `v` the value.
- `t` is unix seconds and is optional; if it's missing, the server uses the time it received the reading.
- Up to 100 readings per request, and at most one request every 5 s.
- Readings up to 7 days old are accepted, so the board's buffer can catch up after Wi-Fi comes back.

The reply looks like this:
```json
{ "ok": true, "accepted": 8, "rejected": [], "interval_s": 300,
  "commands": [{ "id": "…", "channel": "aerator1", "action": "on", "duration_s": 900 }] }
```

Rejected reasons:
- `unknown_channel`: the channel isn't registered for this device.
- `disabled`: the channel is switched off in the app.
- `out_of_range`: the value is physically impossible. The farmer gets a "sensor may be faulty" alert.
- `bad_time`: the timestamp is too far in the future or the past.

## 5. TLS certificate
The board must verify the server's certificate. `setInsecure()` is not allowed, because it would let anyone impersonate the server and send pump commands. To get the root certificate:
```bash
openssl s_client -connect yrlfpbbbvjfguoratasn.supabase.co:443 -showcerts </dev/null
```
Take the **last** certificate in the chain (the root), or download that root from its issuer's website, and paste it into `ROOT_CA`. If you use MQTT, do the same for your EMQX host and paste both PEMs into `ROOT_CA`.

## 6. MQTT with EMQX Cloud (optional)
Use this when a node sits behind a network where MQTT is more reliable than HTTPS. Equipment controllers always use HTTPS for commands.

1. Create a free **EMQX Cloud Serverless** deployment at emqx.com, and note the host and port 8883.
2. **Access control → Authentication**: add one user per device, with **username = Device ID** and **password = Device key**.
3. **Access control → Authorization**: allow each user to publish only to `agriaqua/${username}/up`, and deny everything else.
4. **Data integration → HTTP server**: URL `https://yrlfpbbbvjfguoratasn.supabase.co/functions/v1/ingest`, method POST, header `Content-Type: application/json`.
5. Add a rule for that HTTP connector:
   ```sql
   SELECT payload FROM "agriaqua/+/up"
   ```
   Set the action body to `${payload}`. The board puts `device_id` and `key` in the payload, so `ingest` authenticates it exactly like an HTTPS device.
6. In `secrets.h`, set `USE_MQTT 1`, `MQTT_HOST` and `MQTT_PORT`.

## 7. Simulator (no hardware)
In the app: **Monitor → Add device → "Simulated device"**, then **Run simulator**. Scenarios: normal, low oxygen, dry soil, fever, sensor fault.
- Simulated data is stored with `source = simulated` and shows a **SIMULATED** badge everywhere.
- Simulated devices can never control equipment, and their alerts are labelled "(simulated)".
- Simulated readings are deleted after 30 days.

There is no script that posts as a real device: a real device key always means real measurements.
