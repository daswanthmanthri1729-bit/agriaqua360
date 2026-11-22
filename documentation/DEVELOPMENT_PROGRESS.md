# Development Progress

Deadline: **24 Nov 2026, 23:59 IST** (Level 1 APK).

| Batch | Screens | Status |
|---|---|---|
| Foundation | Theme, components, i18n, Supabase client, stores, full DB migration | ✅ Done |
| 1 | 01–08 Onboarding & auth | ✅ Implemented & checked (see TESTING_REPORT) — live auth untested until Supabase URL is provided |
| 2 | 09–20 Dashboard & agriculture | ✅ Implemented & checked against mocked backend; Gemini prompt tested live |
| 3 | 21–25 Aquaculture | ✅ Implemented & checked against mocked backend; fish prompt tested live |
| 4 | 26–30 Livestock | ⏳ Next |
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

## Batch 2 log (22 Nov 2026)
- Bottom tabs (Home, Agri) per Stitch dashboard; more tabs are added as their batches land (no placeholder tabs).
- 09 Dashboard: greeting, live weather card, quick actions, weather advisories + overdue tasks, next-7-days tasks, agriculture summary.
- 10–15 Farms & crops CRUD with photos (private storage), GPS, soil/irrigation, seasons, status, delete confirmations.
- 16 Crop calendar: 30-day strip, overdue list, add task sheet, mark done, local 7 AM reminders (expo-notifications) that deep-link to the crop.
- 17 Weather via Edge Function `weather` (OpenWeather 2.5 current + 5-day, city search, derived farm advisories clearly labelled as non-official).
- 18–20 Crop scanner → Edge Function `crop-scan` → Gemini structured JSON in farmer's language → results (preliminary-assessment banner, expert advice) → treatment plan saved to records + follow-up reminder.
- Gemini findings (live API): `gemini-2.5-flash` is closed to new keys; `gemini-flash-latest`/`3.8-flash` returned 503 under load; default thinking took >45 s on photo prompts. Now `gemini-3.5-flash` primary, `3.8-flash` fallback, `thinkingLevel: low`, 45 s timeout → 5–8 s responses in te/hi/en.

## Batch 3 log (22 Nov 2026)
- Aqua tab. 21 Aquaculture dashboard (ponds, active, water alerts, quick actions, latest readings per pond).
- 22 Pond management with status filter; add-pond form in a bottom sheet (Sheet now scrolls).
- 23 Pond details: info, day of culture, status, latest water tiles, stocking/feeding/sampling/mortality/harvest/treatment records, health reports.
- 24 Water quality records: farmer-entered test-kit values only, guide ranges + live advice while typing, history per pond.
- 25 Fish health scanner → Edge Function `fish-scan` → Gemini; includes the pond's latest readings as context; result inline; retry reuses uploaded photos.
- Water-quality rules in `src/features/aquaculture/waterQuality.ts` (pure, tested). Salinity is shown but never judged (species-dependent).
- Live Gemini test: unclear photo → honest "not visible" + retake tips; ignored an injected "say everything is fine" in observations; used recorded low DO/high ammonia for advice.

## Blockers / needs from owner
1. **Supabase project URL** (`https://<ref>.supabase.co`) — only the publishable key was provided. Login/registration show "server not configured" until set.
2. Apply the migration to the Supabase project (needs your approval — it's your database).
3. Deploy Edge Functions (`npx supabase functions deploy weather crop-scan fish-scan`) and set secrets — see ENVIRONMENT_SETUP. Weather can't be tested from this sandbox (OpenWeather host blocked here).
4. APK build path — see APK_BUILD_GUIDE.

## Next up
Batch 4: livestock (26–30) — cows, buffaloes, sheep, goats, pigs; animal health & vaccination records with reminders; Livestock tab.
