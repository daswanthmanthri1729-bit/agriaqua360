# Screen Implementation Status

✅ implemented & checked · 🟡 implemented, live-backend untested · ⏳ not started

| # | Screen | Route | Stitch reference | Status |
|---|---|---|---|---|
| 01 | Splash | `/` | 01_splash_loading_screen_1 | ✅ |
| 02 | Welcome | `/onboarding/welcome` | 02_welcome_screen_1 | ✅ |
| 03 | Language Selection | `/onboarding/language` | 05_language_selection_screen | ✅ |
| 04 | Permissions Setup | `/onboarding/permissions` | — (system-derived) | ✅ (native prompts need device) |
| 05 | Login (+ forgot-password sheet) | `/auth/login` | 03_login_screen_1 | 🟡 |
| 06 | Registration | `/auth/register` | 04_farmer_registration_screen_1 | 🟡 |
| 07 | OTP Verification (signup + recovery) | `/auth/otp` | — | 🟡 |
| 08 | Farmer Profile Setup | `/auth/profile-setup` | — | 🟡 |
| 09 | Main Dashboard | `/home` (temporary stub) | 06_home_dashboard_screen | ⏳ |
| 10–20 | Agriculture | | 08–25 | ⏳ |
| 21–25 | Aquaculture | | 26–39 | ⏳ |
| 26–30 | Livestock | | — | ⏳ |
| 31–40 | AI / voice / records / settings | | 40, ask_anything, voice_search, visual_search, ai_follow_up, 41, 47 | ⏳ |

Stitch extras not in the 40 (sensors, GPS mapping, market prices, expenses, backup) are out of Level 1 scope.
