# Screen Implementation Status

✅ implemented & checked · 🟡 implemented & E2E-tested against a mocked Supabase; real-backend untested · ⏳ not started

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
| 09 | Main Dashboard | `/home` (tab) | 06_home_dashboard_screen | 🟡 |
| 10 | Farm Management | `/agriculture` (tab) | 08_my_farms_screen_1 | 🟡 |
| 11 | Add New Farm | `/agriculture/farms/new` | 09_add_farm_screen | 🟡 |
| 12 | Farm Details | `/agriculture/farms/[id]` | 10_plot_details_screen | 🟡 |
| 13 | Crop Management | `/agriculture/crops` | 16_crop_library_screen_1 | 🟡 |
| 14 | Crop Details | `/agriculture/crops/[id]` | 17_crop_details_screen | 🟡 |
| 15 | Add New Crop | `/agriculture/crops/new` | — | 🟡 |
| 16 | Crop Calendar | `/agriculture/calendar` | 24_crop_schedule, 47_smart_reminders | 🟡 |
| 17 | Weather | `/agriculture/weather` | 11_current_weather, 12_weather_forecast | 🟡 (live key untested) |
| 18 | Crop Disease Scanner | `/agriculture/scan` | visual_search_agriaqua_360 | 🟡 |
| 19 | Disease Detection Results | `/agriculture/scan/[id]` | visual_search_agriaqua_360 | 🟡 |
| 20 | Treatment Recommendations | `/agriculture/scan/[id]/treatment` | visual_search_agriaqua_360 | 🟡 |
| 21 | Aquaculture Dashboard | `/aquaculture` (tab) | 32_water_quality_dashboard, 26_my_ponds | 🟡 |
| 22 | Pond Management (+ add-pond sheet) | `/aquaculture/ponds` | 26_my_ponds, 27_add_pond | 🟡 |
| 23 | Pond Details (+ fish record sheet) | `/aquaculture/ponds/[id]` | 28_pond_details, 31/35/37/38/39 records | 🟡 |
| 24 | Water Quality Records (+ reading sheet) | `/aquaculture/water-quality` | 32, 33, 34 | 🟡 |
| 25 | Fish Health Scanner (result inline) | `/aquaculture/fish-scan` | visual_search, 49_health_history | 🟡 |
| 26–30 | Livestock | | — | ⏳ |
| 31–40 | AI / voice / records / settings | | 40, ask_anything, voice_search, visual_search, ai_follow_up, 41, 47 | ⏳ |

Stitch extras not in the 40 (sensors, GPS mapping, market prices, expenses, backup) are out of Level 1 scope.
