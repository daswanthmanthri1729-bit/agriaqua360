# API Integrations

| Service | How | Status |
|---|---|---|
| Supabase Auth/DB/Storage | `@supabase/supabase-js` with publishable key, session in AsyncStorage, auto-refresh paused in background | ✅ wired; needs project URL |
| Google Gemini | Edge Function `crop-scan` (Batch 2); `_shared/gemini.ts`: REST + JSON schema, `gemini-3.5-flash` → fallback `gemini-3.8-flash`, `thinkingLevel: low`, 45 s timeout. Override with secret `GEMINI_MODEL` | ✅ crop scan; chat in Batch 5 |
| Speech-to-text | Record with `expo-audio` → Edge Function → Gemini transcription in te/hi/en | ⏳ Batch 5 |
| Text-to-speech | `expo-speech` (device voices; app checks voice availability per language) | ✅ used on language screen |
| Weather | Edge Function `weather`: OpenWeather 2.5 `/weather` + `/forecast` + geocoding, aggregated to daily (pure, tested `_shared/weather.ts`); advisories are app-derived thresholds | 🟡 code done; live call untested |
| Location | `expo-location` foreground only, reverse geocode | ✅ |
| Push | `expo-notifications` + FCM (`google-services.json`), channel `default`; local 7 AM crop/treatment reminders with deep links | 🟡 local reminders done; server push in Batch 5 |
