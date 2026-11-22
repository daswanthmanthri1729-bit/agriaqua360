# AgriAqua 360 — notes for Claude

Read `AGENTS.md` (Expo rules) and `documentation/DEVELOPMENT_PROGRESS.md` (where we are) first.

- Expo SDK 58 / RN 0.88. Install native deps with `EXPO_OFFLINE=1 npx expo install <pkg>` in the cloud sandbox (api.expo.dev is blocked there).
- Routes live in `src/app/` (Expo Router). Non-route code in `src/{components,features,services,hooks,store,lib,theme,locales}`. Import via `@/`.
- Design tokens: `src/theme/index.ts` (from the Stitch "Intelligent Nature" DESIGN.md; Stitch files are not in the repo). Use components from `@/components`; don't hand-roll buttons/inputs.
- **No hard-coded user-facing strings.** Add keys to all three of `src/locales/{en,te,hi}/translation.json`; `tests/i18n.test.ts` fails on missing/untranslated keys.
- Validation messages are i18n keys (zod schemas in `src/features/*/schemas.ts`).
- Secrets: only `EXPO_PUBLIC_*` public values in the app. Gemini/OpenWeather keys live in Supabase Edge Function secrets. Never commit `.env`, `supabase/functions/.env`, `google-services.json`.
- DB changes = new file in `supabase/migrations/`; validate with the local Postgres recipe in `documentation/TESTING_REPORT.md`.
- Before claiming done: `npm run typecheck && npm test` and `EXPO_OFFLINE=1 npx expo export --platform android`.
