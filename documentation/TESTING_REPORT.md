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

### Reproduce the DB test
```bash
initdb -D /tmp/pg -A trust && pg_ctl -D /tmp/pg -o "-p 54329" start
psql -p 54329 -c "create database t"
psql -p 54329 -d t -v ON_ERROR_STOP=1 -f supabase/tests/stubs.sql -f supabase/migrations/20261122000001_initial_schema.sql -f supabase/tests/rls_test.sql
```
