# AgriAqua 360

AI-powered farming app for **agriculture, aquaculture and livestock**, in English, Telugu and Hindi.
React Native (Expo SDK 58, Expo Router, TypeScript) + Supabase + Gemini (via Edge Functions) + FCM.

**Level 2** adds ESP32/MQTT sensors and pump control, Open-Meteo / NASA POWER / SoilGrids, AGMARKNET market prices,
Sentinel-2 NDVI, AI insights, offline-first saving and a screen for each of the 80 Level 2 designs.

```bash
npm install
cp .env.example .env            # fill in Supabase URL + publishable key
npx expo start                  # dev server (needs a dev build for native modules)
npm run typecheck && npm test   # TypeScript + Jest
```

| Doc | What |
|---|---|
| [documentation/DEVELOPMENT_PROGRESS.md](documentation/DEVELOPMENT_PROGRESS.md) | Batch status, what's next |
| [documentation/SCREEN_IMPLEMENTATION_STATUS.md](documentation/SCREEN_IMPLEMENTATION_STATUS.md) | All 40 screens |
| [documentation/ENVIRONMENT_SETUP.md](documentation/ENVIRONMENT_SETUP.md) | Credentials + manual setup (**read first**) |
| [documentation/PROJECT_ARCHITECTURE.md](documentation/PROJECT_ARCHITECTURE.md) | Folders, flows, conventions |
| [documentation/DATABASE_SCHEMA.md](documentation/DATABASE_SCHEMA.md) | 21 tables + RLS |
| [documentation/API_INTEGRATIONS.md](documentation/API_INTEGRATIONS.md) | Supabase, Gemini, weather, FCM |
| [documentation/TESTING_REPORT.md](documentation/TESTING_REPORT.md) | What was actually tested |
| [documentation/APK_BUILD_GUIDE.md](documentation/APK_BUILD_GUIDE.md) | Building the APK |
| [documentation/LEVEL2_SETUP.md](documentation/LEVEL2_SETUP.md) | **Level 2**: API keys, push, sensors, deployment, tests |
| [documentation/LEVEL2_AUDIT_AND_PLAN.md](documentation/LEVEL2_AUDIT_AND_PLAN.md) | Level 2 audit, decisions, architecture |
| [documentation/screen-map.json](documentation/screen-map.json) | Each of the 80 designs → its app route |
| [firmware/esp32/README.md](firmware/esp32/README.md) | ESP32 sensor/controller firmware + MQTT |

Design source: Google Stitch export, "Intelligent Nature" design system (kept outside this repository).
