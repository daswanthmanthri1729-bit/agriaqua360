// Copy to secrets.h and fill in. secrets.h is gitignored — never commit device keys or Wi-Fi passwords.
#pragma once
#define WIFI_SSID "your-wifi"
#define WIFI_PASS "your-wifi-password"

// From the app: Monitor → Add device → (shown once after registering)
#define DEVICE_ID  "00000000-0000-0000-0000-000000000000"
#define DEVICE_KEY "aq_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
#define INGEST_URL "https://yrlfpbbbvjfguoratasn.supabase.co/functions/v1/ingest"
#define REPORT_INTERVAL_S 300

// MQTT (optional, sensor-only nodes). Broker: EMQX Cloud Serverless — see README.
#define USE_MQTT 0
#define MQTT_HOST "xxxxxx.ala.asia-southeast1.emqxsl.com"
#define MQTT_PORT 8883

// Root CA for TLS. Supabase and EMQX Cloud certificates chain to these public roots; paste the PEM(s) here.
// See README → "TLS certificate". Using setInsecure() is NOT allowed: it would let anyone impersonate the server.
static const char ROOT_CA[] = R"PEM(
-----BEGIN CERTIFICATE-----
...paste root certificate(s) here...
-----END CERTIFICATE-----
)PEM";
