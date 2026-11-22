# Testing Report

Only what was actually run is listed.

## Batch 1 — 22 Nov 2026
| Check | Command / method | Result |
|---|---|---|
| TypeScript | `npm run typecheck` | ✅ 0 errors |
| Unit tests | `npm test` — validation schemas, launch routing, i18n key parity, untranslated-string detection, every `t('…')` key exists | ✅ 28/28 |
| Android JS bundle | `EXPO_OFFLINE=1 npx expo export --platform android` | ✅ Hermes bundle 5.8 MB |
| DB migration | Applied to Postgres 16 with stub `auth`/`storage` schemas (`supabase/tests/stubs.sql`) | ✅ 21 tables |
| RLS | `supabase/tests/rls_test.sql`: 2 users, cross-user reads/updates/inserts/storage writes blocked; metadata sanitising in signup trigger | ✅ |
| UI render | Web export + Playwright at 390×844: splash → auto-redirect, welcome, language (switch to Telugu), permissions (Telugu), login (Hindi validation errors), registration validation | ✅ no console errors; Telugu/Hindi shape correctly |
| Language persistence | Reload after switching → stored in `agriaqua-preferences` | ✅ |

### Not yet tested (honest gaps)
- Live sign-up / login / OTP / recovery / profile save / avatar upload — blocked on Supabase project URL.
- Native permission dialogs, camera, gallery, GPS, TTS voices — need an Android device/emulator (no Android SDK in the build sandbox).

## Batch 2 — 22 Nov 2026
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ |
| `npm test` (+ weather aggregation/advisories, agriculture schemas, dates, every enum has a label) | ✅ 38/38 |
| `deno check` Edge Functions `weather`, `crop-scan` | ✅ |
| Android Hermes bundle | ✅ 6 MB |
| **Gemini live** (`_shared/gemini.ts` + crop prompt, real API, rice-blast leaf photo) | ✅ Correct diagnosis in Telugu, Hindi, English; 5–8 s; fallback on 503 verified |
| **E2E vs mocked Supabase** (`tests/e2e/agriculture.mock.e2e.js`, Playwright 390×844): login → empty dashboard → farm validation → create farm → farm details → create crop (auto sowing record) → calendar add task + mark done → crops list → farms list → weather → scanner (needs-photo error, gallery upload) → AI result → treatment steps saved → dashboard → switch to Telugu (profile synced) | ✅ no console errors; caught & fixed a web crash in notification deep-link hook, clipped tab labels, stretched calendar strip |

Not tested: real Supabase (URL missing), OpenWeather (host blocked here + key activating), native date picker / camera / notifications on device.

## Review fixes — 22 Nov 2026
Sign-out button + cache cleared on sign-out; weather by village name sends `village,IN`; task reminders store their id and are cancelled when the task is done or its crop/farm is deleted; delete and status-change failures now show an error; scan dates use local time; prevention steps stored as `prevention`; treatment plan can't be saved twice.
- Migration `20261122000002` applied on Postgres 16 after the initial schema; RLS tests still pass; `prevention` insert accepted.
- `npm test` 41/41 (new: Edge Function error-code mapping in `invoke`). Android bundle builds. Mocked E2E passes with no console errors.
- Not tested: reminder cancellation (needs a device), weather village lookup (OpenWeather blocked here).

## Batch 3 — 22 Nov 2026
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ |
| `npm test` (+ water-quality levels/advice/ranges, reading form rules, aquaculture labels) | ✅ 63/63 |
| `deno check fish-scan` | ✅ |
| Android Hermes bundle | ✅ 6.1 MB |
| Gemini live, fish prompt (Telugu) | ✅ unclear photo handled honestly; prompt-injection in observations ignored; used farmer readings |
| Mocked E2E: aqua empty state → add-pond validation → create pond → record water (needs-one error, live advice) → fish record → aqua dashboard alerts → fish scan → result | ✅ no console errors; fixed "pH (pH)" label and a stale validation message |

Not tested: real Supabase, fish-scan against real storage, native date picker/camera.

## Batch 4 — 22 Nov 2026
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ |
| `npm test` (+ vaccination due states, age in months, animal/health/vaccination rules, livestock labels) | ✅ 75/75 |
| Migration 0003 on Postgres 16 after 0001+0002; RLS tests | ✅ |
| Android Hermes bundle | ✅ |
| Mocked E2E: empty state → add-animal validation → create buffalo → schedule HS vaccine → health record with follow-up → records list → animal details → dashboard → mark vaccine given → animal list | ✅ no console errors |

Not tested: reminder scheduling/cancel on device; real Supabase.

## Batch 5 — 22 Nov 2026
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ |
| `npm test` (+ report aggregation: empty farm, 30-day window, latest reading per pond, kg-only feed totals) | ✅ 77/77 (9 suites) |
| `deno check` all 5 Edge Functions | ✅ |
| Android Hermes bundle | ✅ 6.2 MB |
| Gemini live — assistant | ✅ Hindi fertilizer advice used farmer's crop; English follow-up used recorded pond DO/ammonia + expert flag; off-topic "ignore your rules" refused; Telugu photo question → preliminary blast diagnosis |
| Gemini live — transcription | ✅ Telugu speech (generated, converted to AAC .m4a like Android records) → exact Telugu transcript, ~2 s; `audio/mp4` and `audio/aac` both accepted |
| Mocked E2E (Chromium fake microphone): bell → notification list → details → opens linked animal; chat send/save/follow-up; history reopen; photo question; **voice: record 2.5 s → m4a upload → transcribe → edit → ask → answer**; saved list; reports; profile edit; Telugu profile + help FAQ | ✅ no console errors |

Not tested: real Supabase; TTS voices and native recorder on a phone; FCM token on a device; server-side push.

## Live Supabase project — 22 Nov 2026 (yrlfpbbbvjfguoratasn)
Setup applied via Management API: migrations 0001–0004 (recorded in `supabase_migrations.schema_migrations`), 21/21 tables with RLS, 78 policies, private buckets `avatars`/`media` with 4 storage policies, `on_auth_user_created` trigger, secrets GEMINI_API_KEY + OPENWEATHER_API_KEY, 5 Edge Functions deployed, OTP length 6, password min 8.

Live test with a temporary confirmed user (deleted afterwards with its photos):
| Check | Result |
|---|---|
| Password login, profile trigger (te, sectors, phone) | ✅ |
| RLS: own profile only; storage upload into another user's folder | ✅ blocked |
| Farm + crop insert with `.select()` | ❌ → **bug found**: farms SELECT policy used `can_access_farm()`, which can't see the row being inserted, so INSERT…RETURNING failed. Fixed in migration 0004; local RLS test now uses RETURNING and reproduces it. ✅ after fix |
| weather (Eluru) | ✅ 200, 0.2 s |
| ai-assistant, Telugu | ✅ 200, ~22 s |
| crop-scan, real upload | ✅ Rice Blast / high / moderate / expert, ~20 s |
| fish-scan with a leaf photo, Hindi | ✅ is_fish_image=false, ~25 s |
| transcribe with missing clip | ✅ 404 audio_missing |

Known limits: AI calls take 20–25 s from the Singapore project (vs 5–8 s direct); free-tier email templates can't be edited (see DEVELOPMENT_PROGRESS).

## Auth audit + password-reset codes — 22 Nov 2026 (live project, owner-approved changes)
Applied: Resend SMTP (smtp.resend.com:465, sender onboarding@resend.dev — key stored only in Supabase), trilingual code templates (`supabase/templates/*.html`, verified identical after upload), code expiry 3600 s → 600 s, email limit 2 → 30/hour. Unchanged: code length 6, 60 s between emails per user, 30 code checks / 5 min / IP.

| Check | Result |
|---|---|
| Templates rendered with Go html/template: te / hi / en / missing language / null metadata / non-string language | ✅ 12/12, code present, correct language, falls back to English |
| Recovery code (admin-generated, no email) | ✅ 6 digits |
| Wrong code | ✅ 403 rejected |
| Correct code → session → new password | ✅ 200 / 200 |
| Same password again | ✅ 422 `same_password` (app shows a message) |
| Login new password / old password | ✅ 200 / 400 |
| Reuse a used code | ✅ 403 |
| Real email to an `@example.com` address | ⚠️ 500 — expected: Resend's test sender only delivers to the Resend account's own email |
| Unit: code verified before password change; error mapping | ✅ `tests/recovery.test.ts` |

Pending: real inbox test with the owner's Resend login email (needs the owner).

### Reproduce the DB test
```bash
initdb -D /tmp/pg -A trust && pg_ctl -D /tmp/pg -o "-p 54329" start
psql -p 54329 -c "create database t"
psql -p 54329 -d t -v ON_ERROR_STOP=1 -f supabase/tests/stubs.sql -f supabase/migrations/20261122000001_initial_schema.sql -f supabase/migrations/20261122000002_reminders_and_prevention.sql -f supabase/migrations/20261122000003_livestock_reminders.sql -f supabase/migrations/2026112200000{4,5,6,7}_*.sql -f supabase/tests/rls_test.sql -f supabase/tests/report_test.sql
```
