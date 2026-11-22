# Development Progress

Deadline: **24 Nov 2026, 23:59 IST** (Level 1 APK).

| Batch | Screens | Status |
|---|---|---|
| Foundation | Theme, components, i18n, Supabase client, stores, full DB migration | ✅ Done |
| 1 | 01–08 Onboarding & auth | ✅ Implemented & checked (see TESTING_REPORT) — live auth untested until Supabase URL is provided |
| 2 | 09–20 Dashboard & agriculture | ✅ Implemented & checked against mocked backend; Gemini prompt tested live |
| 3 | 21–25 Aquaculture | ✅ Implemented & checked against mocked backend; fish prompt tested live |
| 4 | 26–30 Livestock | ✅ Implemented & checked against mocked backend |
| 5 | 31–40 AI, voice, records, settings | ✅ Implemented & checked against mocked backend; Gemini chat + transcription tested live |
| Build | Android APK | ⏳ Needs Expo account token or Android SDK host access (see APK_BUILD_GUIDE) |

## Batch 1 log (22 Nov 2026)
- Inspected Stitch ZIP (66 screen folders + `DESIGN.md`). Extracted and used as reference; the Stitch files are not stored in the repository.
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

## Batch 4 log (22 Nov 2026)
- No new tab (Stitch tab bar is Home/Agri/Aqua/AI/Profile); livestock opens from a home quick action + "Livestock" card.
- 26 Livestock dashboard: herd, needing care, vaccines due (overdue / within 7 days, mark given), by species.
- 27 Animal list with species filter and search. 29 Add animal (cow/buffalo/sheep/goat/pig, tag or name required, breed quick-picks, birth date → age).
- 28 Animal details: status, age, vaccinations, health history, vet/1962 helpline banner when sick.
- 30 Health & vaccination records: inline add forms (avoid nested modals with the photo picker); health photos (≤3); follow-up and vaccination reminders that are cancelled when given or the animal is deleted.
- Migration `20261122000003`: `notification_id` on vaccination_records and animal_health_records.

## Batch 5 log (22 Nov 2026)
- Tabs now match Stitch: Home, Agri, Aqua, AI Advisor, Profile. Home header has a notifications bell with unread count; sign-out moved to Profile.
- 31 AI assistant chat (suggestions, follow-up chips, listen/save/share, expert banner, retry). Edge Function `ai-assistant` stores conversations and adds the farmer's own crops/ponds/animals as context.
- 32 Voice: expo-audio records m4a (max 2 min) → Edge Function `transcribe` (Gemini audio, deletes the clip after) → editable text → answer → TTS in app language (warns if the phone has no voice for it).
- 33 Photo questions (≤3 photos), 34 chat history (open/delete).
- 35/36 Notifications centre + alert details. Every scheduled reminder is also stored in `notifications`, so the centre works even when phone notifications are off; due items only.
- 37 Saved records (crop scans, fish reports, AI answers) open their source. 38 Reports: real 7/30/90-day aggregates (pure, tested), shareable as text.
- 39 Profile & settings: edit, photo, language, notification permission, weather location reset, links, sign out. 40 Help: Kisan Call Centre 1800-180-1551, animal helpline 1962, FAQ, AI disclaimer.
- FCM: device token saved to `profiles.push_token` after login. Server-sent pushes need an FCM service-account key (not provided) — local reminders cover all reminder types today.
- Live Gemini: Hindi fertilizer answer tied to the farmer's paddy; pond follow-up used recorded DO/ammonia; refused an off-topic override; Telugu photo → blast (preliminary). Telugu m4a transcribed verbatim in ~2 s.

## Live setup (22 Nov 2026)
- Supabase project `yrlfpbbbvjfguoratasn` (Singapore): migrations 0001–0004, RLS, storage, secrets, 5 Edge Functions deployed and live-tested (see TESTING_REPORT).
- Auth: email sign-up with **verification turned off** (owner's choice for the demo) — farmers go straight from Registration to Profile Setup. Free-tier email can't use custom templates and is limited to 2 emails/hour, so the 6-digit OTP screen only applies if verification is turned back on with a custom SMTP sender.
- EAS project `@daswanth-m/agriaqua360`; Android signing key managed by Expo.

## Known limits
- Password reset: 6-digit code emails in te/hi/en via Resend SMTP. With the test sender `onboarding@resend.dev`, emails only reach the Resend account owner — verify a domain in Resend and change the sender to reach all farmers.
- Phone/SMS sign-up is off in Supabase; farmers register with email.
- AI responses take ~20–25 s from the deployed functions.
- Weather warnings ring as phone notifications (7 AM the day before), refreshed each time the app is opened. Alerts while the app is never opened need server push (FCM service-account key).

## Next up
1. Install the new APK on an Android phone and smoke-test: register → profile → farm/crop → scan → pond → animal → AI (text, voice, photo) → language switch.
2. Optional: custom SMTP for email verification + password reset codes; FCM service account for server push.

## Level 1 acceptance checklist (22 Nov 2026)
✅ done and verified · 🟡 done, verified only partly (reason given) · ❌ not done

| Criterion | Status | Evidence / gap |
|---|---|---|
| Exactly 40 primary screens | ✅ | 40 route files tagged `// 01`–`// 40`; SCREEN_IMPLEMENTATION_STATUS.md |
| Stitch designs inspected and followed | ✅ | the Stitch export; tokens from DESIGN.md; screenshots compared per batch |
| Navigation works | ✅ | Mocked E2E covers every batch; tab bar per Stitch |
| Authentication works | ✅ | Live: sign-up, login, profile trigger; owner signed up on a real phone |
| Supabase integration works | ✅ | Live project; owner's phone stored 10 AI messages |
| Database migrations prepared | ✅ | 4 migrations, applied live, recorded in schema_migrations |
| RLS policies implemented | ✅ | 21/21 tables, storage per-user; local + live cross-user tests |
| English / Telugu / Hindi | ✅ | Key-parity + untranslated-string tests; Telugu/Hindi screenshots |
| Instant language switch + persists | ✅ | E2E switch + reload; synced to profile and auth metadata |
| Camera / gallery / image uploads | 🟡 | Gallery + upload tested (web E2E, live upload); camera needs a device test |
| Gemini integration + image questions | ✅ | Live: chat te/hi/en, crop scan, fish scan, photo question |
| Voice recording + transcription | 🟡 | Live Telugu m4a transcription; recorder tested with fake mic; device test pending |
| Text-to-speech | 🟡 | Implemented with voice-availability check; depends on phone's installed voices |
| Agriculture / aquaculture / livestock features | 🟡 | Mocked E2E for all; live farm+crop+scan via API; owner hasn't used them on the phone yet |
| Firebase notifications configured | 🟡 | FCM config in APK, token stored; local reminders + weather warnings; server push needs service-account key |
| Weather integration | ✅ | Live OpenWeather via Edge Function (Eluru 31 °C) |
| Password recovery (6-digit OTP) | 🟡 | Live code flow verified; real email to the owner's inbox not yet confirmed; test sender reaches only the Resend owner |
| Error handling | ✅ | Error/empty/loading states on every list; AI/network error mapping tested |
| TypeScript checks pass | ✅ | `npm run typecheck` |
| Application testing completed | 🟡 | 88 unit tests, E2E, live API tests; full on-device run pending |
| Android APK generated | ✅ | EAS preview build (latest: weather notifications) |
| Setup documentation complete | ✅ | 10 documents in README + documentation/ |

## Level 2 — paused 2026-11-22 (resume here)

**Done and live**
- Database: migrations 0008–0013 applied to production; RLS tests (`supabase/tests/level2_test.sql`) pass.
- Edge Functions deployed and tested live (`tests/live/level2.live.mjs`): weather (Open-Meteo), environment (NASA POWER + SoilGrids), market, devices, ingest, insights, satellite, cron. A sweep runs every 5 min.
- ESP32 firmware and its setup guide (`firmware/esp32`).

**App work in progress (typecheck clean, not yet translated)**
- **Tabs** are now Home / Monitor / Sahayak / Insights / Profile. The Agriculture and Aquaculture screens moved to `/agriculture` and `/aquaculture`.
- **Built:**
  - Monitor (tab, add, device detail, history, alerts, automation)
  - Insights (tab, market, outlook, finance, schemes)
  - agriculture/soil, agriculture/irrigation
  - shared Chart / TileMap / SourceBadge / Freshness / InsightCard

**Next steps**
1. `agriculture/field.tsx`: draw the boundary on TileMap, show NDVI history and image.
2. Upgrade the weather screen: hourly forecast, ET0, NASA rainfall vs last year.
3. Upgrade the pond detail screen: live sensors, charts, AI water insight, feeding/growth/mortality.
4. Upgrade the animal detail screen: milk/weight/breeding records, collar data, geofence map (`livestock/geofence.tsx`), AI insight.
5. Add `settings/notifications.tsx` (user_preferences), switch push to Expo tokens, and add a Home intelligence section.
6. Translate all new keys to en/te/hi, adding a test that every `t('…')` key exists.
7. Offline write queue; run lint, tsc, jest and E2E; EAS APK; README and docs; release.

**Keys you still need to add** (screens show "not configured" until then): DATA_GOV_IN_API_KEY, CDSE_CLIENT_ID/SECRET, EMQX account, and the FCM V1 key upload to EAS for push notifications.
