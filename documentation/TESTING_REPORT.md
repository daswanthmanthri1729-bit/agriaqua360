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

### Reproduce the DB test
```bash
initdb -D /tmp/pg -A trust && pg_ctl -D /tmp/pg -o "-p 54329" start
psql -p 54329 -c "create database t"
psql -p 54329 -d t -v ON_ERROR_STOP=1 -f supabase/tests/stubs.sql -f supabase/migrations/20261122000001_initial_schema.sql -f supabase/migrations/20261122000002_reminders_and_prevention.sql -f supabase/tests/rls_test.sql
```
