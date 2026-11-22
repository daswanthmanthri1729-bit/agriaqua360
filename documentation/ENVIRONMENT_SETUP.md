# Environment Setup

## Files (all git-ignored)
| File | Contents | Where it's used |
|---|---|---|
| `.env` | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Bundled into the app (public values only) |
| `supabase/functions/.env` | `GEMINI_API_KEY`, `OPENWEATHER_API_KEY` | Edge Function secrets — never in the app |
| `google-services.json` | Firebase Android config for `com.agriaqua360.app` | Android build (FCM) |

Templates: `.env.example`, `supabase/functions/.env.example`.

## Credential status
| Credential | Status |
|---|---|
| Supabase publishable key | ✅ provided |
| **Supabase project URL** | ❌ **missing** — Settings → API → Project URL |
| Gemini API key | ✅ provided (server-side only) |
| OpenWeather API key | ✅ provided (activates ~2h after creation) |
| Firebase `google-services.json` | ✅ provided |
| FCM server credentials (service account) | ❌ needed in Batch 5 for server-sent pushes |
| Expo account / `EXPO_TOKEN` | ❌ needed for EAS cloud builds |

## Manual Supabase setup
1. Link and push the schema (approval needed; touches your project):
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
2. Auth → Providers → Email: enabled, "Confirm email" on. Auth → Email Templates → *Confirm signup* and *Reset password*: include `{{ .Token }}` so users receive a 6-digit code (the app verifies codes, not links).
3. Optional SMS OTP: Auth → Providers → Phone → configure Twilio/MessageBird. Without it, register with an email (the app tells users this if SMS fails).
4. Secrets: `npx supabase secrets set --env-file supabase/functions/.env`
5. Deploy functions: `npx supabase functions deploy weather crop-scan`
