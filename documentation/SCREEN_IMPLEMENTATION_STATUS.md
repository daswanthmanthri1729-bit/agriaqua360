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
| 26 | Livestock Dashboard | `/livestock` | 06_home_dashboard (Livestock Hub card) | 🟡 |
| 27 | Animal Management | `/livestock/animals` | — | 🟡 |
| 28 | Animal Details | `/livestock/animals/[id]` | — | 🟡 |
| 29 | Add New Animal | `/livestock/animals/new` | — | 🟡 |
| 30 | Health & Vaccination Records | `/livestock/records` | — | 🟡 |
| 31 | AI Farming Assistant | `/assistant` (tab) | ask_anything, ai_follow_up_conversation, 40_ai_hub | 🟡 |
| 32 | Voice Question Interface | `/assistant/voice` | voice_search_agriaqua_360 | 🟡 |
| 33 | Ask AI Using Images | `/assistant/image` | visual_search_agriaqua_360 | 🟡 |
| 34 | AI Chat History | `/assistant/history` | — | 🟡 |
| 35 | Notifications Centre | `/notifications` | 47_smart_reminders | 🟡 |
| 36 | Alert Details | `/notifications/[id]` | — | 🟡 |
| 37 | Saved Farming Records | `/records/saved` | 41_offline_mode_saved_records | 🟡 |
| 38 | Farming Reports | `/reports` | — | 🟡 |
| 39 | Profile and Settings | `/profile` (tab) | 52_backup_restore_data_privacy | 🟡 |
| 40 | Help and Support | `/help` | 51_expert_consultation_support | 🟡 |

**Total: 40 primary screens** (one route file each, tagged `// NN ·` at the top). Sheets and inline forms are not counted.

Stitch extras not in the 40 (sensors, GPS mapping, market prices, expenses, backup) are out of Level 1 scope.
