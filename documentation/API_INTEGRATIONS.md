# API Integrations

| Service | How | Status |
|---|---|---|
| Supabase Auth/DB/Storage | `@supabase/supabase-js` with publishable key, session in AsyncStorage, auto-refresh paused in background | ✅ wired; needs project URL |
| Google Gemini | Edge Functions `crop-scan`, `fish-scan`, `ai-assistant` (chat with farm context, history, photos), `transcribe`; `_shared/gemini.ts`: REST + JSON schema, `gemini-3.5-flash` → fallback `gemini-3.8-flash`, `thinkingLevel: low`, 45 s timeout. Override with secret `GEMINI_MODEL` | ✅ all live-tested |
| Speech-to-text | `expo-audio` m4a (mono, 64 kbps, ≤2 min) → Edge Function `transcribe` (Gemini audio; clip deleted after) | ✅ live-tested with Telugu |
| Text-to-speech | `expo-speech` via `services/speech.ts` (checks the phone has a voice for te/hi/en, warns if not) | ✅ language screen + every AI answer |
| Weather | Edge Function `weather`: OpenWeather 2.5 `/weather` + `/forecast` + geocoding, aggregated to daily (pure, tested `_shared/weather.ts`); advisories are app-derived thresholds | 🟡 code done; live call untested |
| Location | `expo-location` foreground only, reverse geocode | ✅ |
| Push | `expo-notifications` + FCM (`google-services.json`), channel `default`; local 7 AM crop/treatment reminders with deep links | 🟡 local reminders + in-app centre done; FCM token saved to `profiles.push_token`; server-sent push needs an FCM service account |
