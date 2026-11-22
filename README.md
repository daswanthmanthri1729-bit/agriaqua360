# AgriAqua 360

AI-powered farming app for **agriculture, aquaculture and livestock**, in English, Telugu and Hindi.
React Native (Expo SDK 58, Expo Router, TypeScript) + Supabase + Gemini (via Edge Functions) + FCM.

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

Design source: `design_reference/stitch/` (Google Stitch export, "Intelligent Nature" design system).
