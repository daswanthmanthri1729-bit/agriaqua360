# API Integrations

| Service | How | Status |
|---|---|---|
| Supabase Auth/DB/Storage | `@supabase/supabase-js` with publishable key, session in AsyncStorage, auto-refresh paused in background | ✅ wired; needs project URL |
| Google Gemini | Supabase Edge Function `ai-assistant` holds `GEMINI_API_KEY`; app sends text/image paths/audio + language | ⏳ Batch 5 (scanner in Batch 2) |
| Speech-to-text | Record with `expo-audio` → Edge Function → Gemini transcription in te/hi/en | ⏳ Batch 5 |
| Text-to-speech | `expo-speech` (device voices; app checks voice availability per language) | ✅ used on language screen |
| Weather | Edge Function `weather` proxies OpenWeather with `OPENWEATHER_API_KEY` | ⏳ Batch 2 (key activating) |
| Location | `expo-location` foreground only, reverse geocode | ✅ |
| Push | `expo-notifications` + FCM (`google-services.json`), channel `default` | 🟡 permission + channel done; delivery in Batch 5 |
