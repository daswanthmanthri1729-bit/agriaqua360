# APK Build Guide

App: **AgriAqua 360** · package `com.agriaqua360.app` · version 1.0.0 (versionCode 1).

`eas.json` profiles: `preview` → installable APK, `production` → APK for final hand-in.

## Option A — EAS cloud build (chosen), Android only
`.easignore` makes EAS upload `google-services.json` and `.env` (public values) but never `supabase/functions/.env` or design files.
`app.config.js` builds without FCM if `google-services.json` is missing instead of failing.

```bash
npx eas-cli@latest login
npx eas-cli@latest init                       # links project, writes projectId
npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co --environment preview --visibility plaintext
npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value <key> --environment preview --visibility plaintext
npx eas-cli@latest env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --environment preview --visibility secret
npx eas-cli@latest build -p android --profile preview
```
The finished APK is downloadable from the build page / printed URL.

## Option B — local build (needs Android SDK + JDK 17/21)
```bash
npx expo prebuild -p android
cd android && ./gradlew assembleRelease
```
Output: `android/app/build/outputs/apk/release/app-release.apk`.

## Status
Not built yet. The cloud sandbox can't reach `dl.google.com` (Android SDK) and has no Expo login, so the APK needs either an `EXPO_TOKEN` or a machine with the Android SDK.

## Android permissions (why Play Protect may warn)
The APK requests only: location (weather/farm GPS), camera, microphone (voice questions), notifications, internet, vibrate, and legacy storage (Android ≤ 12 gallery).
Blocked on purpose in `app.json`: background location and SYSTEM_ALERT_WINDOW ("display over other apps", added by the Expo template and a common Play Protect trigger). expo-audio background playback is off (no foreground service).
Sideloaded APKs from a new developer can still show a Play Protect warning; installing via Google Play (internal testing) removes it.
