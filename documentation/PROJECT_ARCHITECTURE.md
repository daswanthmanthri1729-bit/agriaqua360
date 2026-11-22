# Project Architecture

```
src/
  app/                 Expo Router routes (one file = one screen)
    index.tsx          01 Splash → decides first route (features/auth/routing.ts)
    onboarding/        02 welcome, 03 language, 04 permissions
    auth/              05 login, 06 register, 07 otp, 08 profile-setup
  components/          Design-system primitives (AppText, Button, TextField, Card, Chip, Banner, Sheet, …)
  features/<domain>/   Domain logic: zod schemas, API calls, flow state
  services/            Device + platform services: media (pick/compress/upload), location, permissions
  store/               zustand: preferences (persisted), session (Supabase auth + profile)
  locales/             i18next init + en/te/hi translation.json
  lib/                 env, supabase client
  theme/               Tokens from Stitch DESIGN.md
supabase/migrations/   SQL schema + RLS; supabase/tests/ local validation
design_reference/      Stitch export (read-only reference)
tests/                 Jest
```

## Key flows
- **Launch:** fonts + persisted prefs hydrate → splash (≥1.8s) → `nextRoute()` picks welcome / permissions / register / login / profile-setup / home.
- **Language:** `useLanguage().change()` → `i18n.changeLanguage` (instant re-render everywhere) → persisted → `profiles.preferred_language` when signed in.
- **Signup:** register → Supabase `signUp` (email or phone) → OTP screen → `verifyOtp` → DB trigger already created `profiles` row from metadata → profile setup → home.
- **Recovery:** login sheet → code to email/phone → OTP screen (recovery mode) → new password.
- **Media:** picker → resize ≤1600px, JPEG 0.7 → private bucket at `<uid>/<folder>/<file>` (RLS keyed on first path segment).

## Conventions
- Server state: TanStack Query (from Batch 2). Client state: zustand.
- Forms: react-hook-form + zod; error messages are i18n keys.
- AI and weather calls go through Supabase Edge Functions so keys never ship in the APK.
