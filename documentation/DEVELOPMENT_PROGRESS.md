# Development Progress

Deadline: **24 Nov 2026, 23:59 IST** (Level 1 APK).

| Batch | Screens | Status |
|---|---|---|
| Foundation | Theme, components, i18n, Supabase client, stores, full DB migration | ✅ Done |
| 1 | 01–08 Onboarding & auth | ✅ Implemented & checked (see TESTING_REPORT) — live auth untested until Supabase URL is provided |
| 2 | 09–20 Dashboard & agriculture | ⏳ Next |
| 3 | 21–25 Aquaculture | ⏳ |
| 4 | 26–30 Livestock | ⏳ |
| 5 | 31–40 AI, voice, records, settings | ⏳ |
| Build | Android APK | ⏳ Needs Expo account token or Android SDK host access (see APK_BUILD_GUIDE) |

## Batch 1 log (22 Nov 2026)
- Inspected Stitch ZIP (66 screen folders + `DESIGN.md`). Extracted to `design_reference/stitch/` (ZIP kept locally under `design_reference/zips/`, git-ignored).
- Stitch covers splash, welcome, login, registration, language selection. Permissions, OTP and Profile Setup had no frame → built from the same system.
- Scaffolded Expo SDK 58 + TypeScript + Expo Router (`src/app`).
- Design system: Manrope/Inter, Intelligent Nature palette, 52px controls, 48dp touch targets, +18% line-height for Telugu/Hindi.
- i18n: en/te/hi, instant switch, persisted (AsyncStorage) and synced to `profiles.preferred_language`.
- Auth: email or phone + password, signup OTP (email by default; SMS if Supabase phone provider configured), password recovery by code, session persistence.
- Profile setup: GPS + reverse-geocode autofill, avatar via camera/gallery → compressed → private `avatars` bucket.
- Migration: all 21 tables, RLS on every table, private storage buckets with per-user folder policies. Validated on Postgres 16 with RLS isolation tests.

## Blockers / needs from owner
1. **Supabase project URL** (`https://<ref>.supabase.co`) — only the publishable key was provided. Login/registration show "server not configured" until set.
2. Apply the migration to the Supabase project (needs your approval — it's your database).
3. OpenWeather key activates ~2h after creation; will be wired in Batch 2 through an Edge Function.
4. APK build path — see APK_BUILD_GUIDE.

## Next up
Batch 2: main dashboard (09) replacing the temporary `/home`, farms CRUD, crops, crop calendar, weather Edge Function, crop disease scanner via Gemini Edge Function.
