# AgriAqua 360 — Level 2 audit and plan

Stage 1 (audit) and Stage 2 (architecture) of the Level 2 upgrade.

**Decisions (owner, 2026-11-22):** consolidated screens (not 80 separate ones) · build ALL four extra groups (pump/valve/aerator control, livestock GPS & wearables, government schemes & subsidies, farm costs & profit) · switch to the new tabs **Home / Monitor / Sahayak / Insights / Profile** · build now, add data.gov.in / Copernicus / EMQX keys later.

**Safety rules for equipment control:** every command needs an explicit confirm tap, has a maximum run time (auto-off on the device), is logged, and the device's local manual switch always wins. Automation rules are off until the farmer turns each one on; a rule never runs on simulated readings.

## 1. What Level 1 already has (it all works, and all of it stays)

| Area | Status |
|---|---|
| Screens | 40 routes in `src/app` (onboarding, auth + OTP, 5 tabs, farms, crops, calendar, crop scan + treatment, weather, ponds, water quality, fish scan, livestock, vaccinations, assistant: text/voice/photo + history, notifications, saved, reports, help, profile) |
| Backend | Supabase: 21 tables with RLS, private storage, 7 migrations; Edge Functions `ai-assistant` (streams), `crop-scan`, `fish-scan`, `transcribe`, `weather` (OpenWeather + 30-minute server cache) |
| AI | Gemini, server-side only, with model fallback when quota runs out, structured JSON, streaming, and answers that use farm context |
| Speed and offline | TanStack Query cache saved to disk, offline banner, photos compressed before upload, stale data kept visible when a refresh fails, 0.7 s splash |
| Languages | en / te / hi (~890 strings), switching works instantly |
| Notifications | Local reminders, weather warnings, multilingual |
| Builds | EAS Android APK, Windows (Electron) zip, GitHub Release v1.0.0 |
| Tests | 91 Jest tests, Playwright E2E (mocked backend), live backend tests, Deno tests, SQL RLS tests |

Broken: nothing known. Main limit: the **Gemini free tier** (20 requests/day on the bigger models). Level 2 adds more AI use, so heavy use will hit "AI busy" more often until a paid key is used.

## 2. What Level 2 is missing (requirement → gap)

| Requirement | Level 1 today | Missing |
|---|---|---|
| IoT / ESP32 / MQTT | none | devices, sensor types, readings, alerts, thresholds, calibration, ingestion endpoint, live updates (Realtime), simulator, firmware |
| Data source labels | readings are manual | a `source` column on every reading (sensor / simulated / manual / api / ai_estimate) and a badge in the UI |
| Soil intelligence | soil type text only | soil sensor history, lab soil tests (N-P-K, pH, OC), SoilGrids estimates, each clearly labelled as one of those three |
| Irrigation | none | moisture + rain forecast → recommendation, water-use log |
| Crop intelligence | crops, calendar, scans | growth stage, harvest readiness, productivity (yield records) |
| Water quality | pH, DO, temp, ammonia, salinity, turbidity (Secchi cm) | water level, turbidity in NTU (sensor), live dashboard, charts |
| Aquaculture | ponds, readings, fish records | feeding log, growth samples, mortality, stocking, harvest plan |
| Livestock | profile, health, vaccinations | weight history, feeding, reproduction, milk records, charts |
| Weather | OpenWeather current + 5-day | Open-Meteo (free, no key), NASA POWER hourly history, rainfall analysis |
| Satellite | none | farm boundary, Sentinel-2 NDVI history with date, cloud % and resolution |
| Market prices | none | AGMARKNET mandi prices via data.gov.in, history, mandi comparison, harvest-time price outlook with uncertainty |
| Charts | none | history and forecast charts |
| Offline writes | reads only | queue new records + pending photo uploads, sync when online |
| Notification preferences | none | per-category on/off in Profile |

## 3. The 80 Level 2 designs

The ZIP holds 80 design screens; the files stay local in `design_reference/level2`, which is gitignored. Many show the same thing at different depths (e.g. 6 sensor-analytics variants). The written spec does not ask for several of them.

**Matches the spec. Proposal: fold them into ~24 new screens and upgrade some existing ones:**

| Module | New / upgraded screens | Designs used |
|---|---|---|
| Home | upgrade Home → intelligence dashboard | intelligence_dashboard, smart_farm_command_center, personalized_overview |
| IoT | devices list, add device, device detail (live + calibrate + diagnostics), alert thresholds, sensor history | live_pond_sensor_network, iot_gateway, sensor_intelligence, smart_device_registration_pairing, advanced_device_configuration_diagnostics, sensor_calibration_maintenance, advanced_sensor_threshold_alert_configuration, advanced_sensor_data_analytics_correlation, live_soil_sensors |
| Soil | soil health, add lab test | soil_health_dashboard, ai_soil_intelligence, soil_testing_lab_analysis |
| Irrigation | irrigation advice + water log | smart_irrigation_dashboard, ai_water_management, advanced_rainfall_irrigation_weather_analytics |
| Crops | crop growth & harvest readiness, yield record | crop_growth_intelligence, advanced_crop_maturity, ai_harvest_readiness, ai_crop_yield_* , production_history |
| Disease | existing scan, plus risk/pest notes | ai_disease_detection, crop_health_risk_analysis, pest_intelligence, crop_protection_center, treatment_recovery |
| Weather | upgrade weather → hyperlocal + history + extreme alerts | hyperlocal_weather, extreme_weather_climate_risk, ai_climate_intelligence |
| Satellite | field monitoring (boundary + NDVI history) | field_monitoring_management |
| Aquaculture | upgrade aqua tab, live water quality, feeding, growth, mortality, harvest plan | aquaculture_intelligence_dashboard, pond_water_quality_monitoring, advanced_water_quality_sensor_analytics, fish_behaviour_feeding, fish_growth_production, fish_mortality, fish_health_monitoring, ai_fish_disease_*, ai_aquaculture_* , smart_pond_management_mapping |
| Livestock | upgrade animal profile (weight, feed, reproduction, milk), livestock dashboard | individual_animal_profile, livestock_intelligence_dashboard, livestock_nutrition_feed, ai_livestock_health_* |
| Market | price dashboard, mandi comparison, harvest price outlook | market_price_intelligence_dashboard, mandi_comparison_price_trends, harvest_time_price_estimator, ai_market_demand_supply_price_forecast, smart_harvest_scheduler |
| AI | upgrade assistant (sensor + weather + market context, camera) | unified_ai_farm_assistant, ai_farm_intelligence, unified_ai_prediction_dashboard |
| Settings | notification preferences | emergency_alert_response_center (folded into notifications) |

**Not in the written spec (need a decision):**

| Group | Designs | Why it's flagged |
|---|---|---|
| Pump / valve / aerator remote control | automated_irrigation_control_center, automation_rule_builder, smart_farm_automation_dashboard, irrigation_zone_water_distribution | Switching real pumps and aerators from a phone is safety-critical and needs relay hardware. The spec only asks for monitoring. |
| Livestock GPS collars / wearables | gps_livestock_location_geofencing, smart_livestock_wearable_dashboard, real_time_animal_health_sensor_monitor, ai_livestock_activity_anomaly | Needs collar hardware that isn't in the spec's sensor list |
| Government schemes / subsidy / insurance | government_schemes_subsidy_discovery, ai_scheme_eligibility_checker, subsidy_insurance_farm_support, application_guidance_farmer_service_center | No reliable official API. The data would have to be hand-maintained and can go out of date. |
| Farm costs and profit | smart_cultivation_cost_tracker, production_cost_profitability_estimator, farm_financial_intelligence_dashboard, ai_farm_cost_optimization | Not in the spec (revenue scenarios are covered by the harvest price outlook) |
| Report generator | smart_farm_report_generator_document_center | The existing Reports screen covers it; PDF export could be added later |

## 4. Architecture (additive — nothing replaced)

```
ESP32 ──MQTT──▶ EMQX Cloud broker (free tier, per-device user/password)
   │                │  rule: forward each message over HTTPS
   └──HTTPS─────────┴──▶ Edge Function `ingest` (device key check, validation, thresholds)
                              ▼
                   Postgres: sensor_readings (source='sensor') ─▶ sensor_alerts ─▶ push
                              ▼
                   Supabase Realtime ─▶ app live dashboards
Simulator (Edge Function / script) writes source='simulated' only — always labelled in the UI.
```

- **No always-on server.** The broker's built-in HTTP rule calls `ingest`; ESP32 boards on Wi-Fi can also post directly over HTTPS.
- **Device authentication:** each device gets an ID and a secret key, shown once. Only a hash is stored. Ingest is rate-limited per device.
- **New Edge Functions:**
  - `ingest`, `devices` (register / rotate key)
  - `weather` upgraded to Open-Meteo, keeping OpenWeather as a fallback
  - `weather-history` (NASA POWER hourly)
  - `soil` (SoilGrids)
  - `market` (data.gov.in AGMARKNET, cached in the database)
  - `satellite` (Sentinel-2 NDVI)
  - `insights` (AI price outlook / water-quality analysis, using only real data)
- **New tables** (only additive: existing tables get extra columns, and nothing is dropped or renamed):
  - IoT: sensor_types, sensor_devices, sensor_readings, sensor_alerts, sensor_thresholds
  - Farm data: farm_boundaries, soil_tests, soil_records, irrigation_logs, weather_records, satellite_observations
  - Market and harvest: market_prices, harvest_records, harvest_forecasts
  - Aquaculture: feeding_logs, growth_samples, mortality_records, stocking info on ponds
  - Livestock: milk_records, reproduction_records, weight_records
  - Settings: user_preferences (notification settings)
  - Column changes: `source` on water_quality_records; water_level_cm and turbidity_ntu
  - Names: the spec's `uploaded_images` and `livestock_health_records` already exist as `uploaded_media` and `animal_health_records`, so they are reused, not renamed.
- **Charts:** Victory Native (needs `@shopify/react-native-skia`; the APK grows by ~6 MB). Versions checked against SDK 58 before install.
- **Styling:**
  - Keep the existing StyleSheet + theme tokens. The new designs use a darker palette and a different font. The spec says to keep the Level 1 identity, so the new layouts use the Level 1 colours and fonts.
  - NativeWind is **not** added: converting 47 styled files would be a major rewrite for no user benefit.
- **Offline writes:** queue in AsyncStorage (TanStack mutation persistence), replay when online, last-write-wins with `updated_at`; photos wait in a pending upload queue.

## 5. External services

| Service | Key needed | Cost | Who sets it up |
|---|---|---|---|
| Open-Meteo | no | free (non-commercial) | me |
| NASA POWER | no | free | me |
| SoilGrids (ISRIC) | no | free | me |
| OpenStreetMap / Nominatim | no | free, 1 req/s | me (server-side cache) |
| data.gov.in (AGMARKNET) | yes, free | free | **you** sign up, then paste the key into the secure form |
| Copernicus Data Space (Sentinel-2) | yes, free OAuth client | free monthly quota | **you** sign up |
| EMQX Cloud Serverless (MQTT) | account | free tier | **you** sign up |
| ISRO VEDAS | no public API | — | not possible; documented |

Until the keys exist, those screens show a clear "not configured yet" state and the simulator covers sensors. Nothing is invented.

This cloud session cannot reach these hosts yet. The Edge Functions on Supabase can, so they're tested there; local testing needs the hosts added to the environment allowlist.

## 6. Stages after approval

1. Database migrations (shown to you before they are applied to production) + RLS tests
2. Edge Functions: weather/NASA/soil/market/satellite/ingest + tests
3. IoT: device registration, ingestion, simulator, ESP32 firmware (`firmware/esp32`), MQTT rule docs
4. Screens, module by module (IoT → soil/irrigation → aquaculture → livestock → weather → satellite → market → home → AI), all three languages
5. Offline write queue, notification preferences, alerts
6. Optimisation, full regression (Level 1 + Level 2), APK via EAS, docs
