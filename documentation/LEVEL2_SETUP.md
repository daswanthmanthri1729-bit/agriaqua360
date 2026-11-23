# AgriAqua 360 Level 2: setup, APIs and deployment

Level 2 adds the following:
- IoT sensors and equipment control (ESP32 over HTTPS or MQTT).
- Weather from Open-Meteo, with NASA POWER history and SoilGrids soil estimates.
- AGMARKNET market prices and the harvest-time price outlook.
- Sentinel-2 NDVI from satellite images.
- AI insights, offline-first record saving, and all 80 design screens (see `screen-map.json`).

## 1. What works with no extra keys
| Feature | Source | Key |
|---|---|---|
| Weather, hourly forecast, ET0, soil-moisture model | Open-Meteo | none |
| Past 30–90 days of weather, rainfall vs last year | NASA POWER (hourly API) | none |
| Soil property estimates | ISRIC SoilGrids 2.0 | none |
| Place names | OpenStreetMap Nominatim / Photon | none |
| Maps | OpenStreetMap tiles | none |
| AI (assistant, insights, planning, scans) | Gemini | `GEMINI_API_KEY` (already set) |
| Sensor simulator | built in | none |

## 2. Keys you add (screens show "not connected yet" until then)
Each key below is a Supabase **Edge Function secret**. Add it in Supabase Dashboard → Edge Functions → Secrets. Never put these keys in the app or in git.

| Secret | For | How to get it (free) |
|---|---|---|
| `DATA_GOV_IN_API_KEY` | Live mandi prices (AGMARKNET) | Sign up at data.gov.in, then go to My Account and generate an API key |
| `CDSE_CLIENT_ID`, `CDSE_CLIENT_SECRET` | Satellite NDVI (Sentinel-2) | Create an account at dataspace.copernicus.eu, then Sentinel Hub dashboard → User settings → OAuth clients → Create |
| *(optional)* `MARKET_RESOURCE_CURRENT`, `MARKET_RESOURCE_HISTORY` | Only if data.gov.in changes its dataset IDs | — |

**Market prices:**
- The first time someone opens a commodity, its prices are downloaded and saved.
- After that, the scheduled sweep refreshes them every day after 06:00 IST.
- Past prices build up over time. The harvest outlook needs at least 2 past years with prices in both months.

**After adding the market key**, open Market prices and pick a commodity. If the screen says "key not valid", check the key on data.gov.in.

## 3. Push notifications (sensor, device and price alerts)
The app registers an **Expo push token**. For Expo to deliver pushes to Android, upload a Firebase **FCM V1 service-account key** once:
1. Open the Firebase console → Project settings → Service accounts → Generate new private key (JSON).
2. Go to expo.dev → project **agriaqua360** → Credentials → Android → FCM V1 service account key → upload the JSON.

Until this is done, alerts still appear live in the app's Alerts & tasks screen, and local weather and reminder notifications keep working.

## 4. Sensors (ESP32) and MQTT
See [firmware/esp32/README.md](../firmware/esp32/README.md) for wiring, flashing, the payload format, TLS certificates and the EMQX Cloud MQTT rule.

In the app, go to Monitor → Add device:
- Choose a real device (you get a key shown once) or a **simulated** device (demo data, always labelled SIMULATED).

## 5. Scheduled sweep
`pg_cron` runs the `cron` Edge Function every 5 minutes. The shared secret is in Supabase Vault (`cron_secret`) and the function secret `CRON_SECRET`.

Each run does the following (the function re-sends itself to the Mumbai region, because data.gov.in only accepts Indian IPs):
- Raises offline-device alerts.
- Expires stale equipment commands.
- Runs the daily market sync and price alerts.
- Deletes simulated readings older than 30 days. Real readings are never deleted.

## 6. Deploying changes
```bash
export SUPABASE_ACCESS_TOKEN=<your personal access token>   # from supabase.com → Account → Access tokens
npx supabase@latest functions deploy weather environment market devices ingest insights satellite cron --project-ref yrlfpbbbvjfguoratasn
```

Database changes live in `supabase/migrations/` (0008–0013 are Level 2). Test them locally first:
```bash
psql -d t -f supabase/tests/stubs.sql -f supabase/migrations/*.sql -f supabase/tests/rls_test.sql -f supabase/tests/report_test.sql -f supabase/tests/level2_test.sql
```

Android APK (EAS cloud):
```bash
npx eas-cli@latest build -p android --profile preview
```

## 7. Tests
| Command | What |
|---|---|
| `npx tsc --noEmit`, `npx expo lint` | Types, lint |
| `npx jest` | 131 unit tests (agronomy, IoT rules, market maths, offline queue, translations, screen map, …) |
| `node tests/e2e/agriculture.mock.e2e.js <web> <shots> <photo>` | Browser E2E: full Level 1 journey, offline save + sync, every design route in English and Telugu |
| `PAT=… node tests/live/level2.live.mjs` | Live checks against the real backend (temporary test user, deleted afterwards) |
| `supabase/tests/*.sql` | Row Level Security and SQL helper tests |
