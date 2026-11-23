## AgriAqua 360 — Level 2 (v2.0.0)

Smart farming platform for **agriculture, aquaculture and livestock**, in **English, తెలుగు and हिन्दी**. Adds to everything in v1.0.0.

### Downloads
| File | For |
|---|---|
| `AgriAqua360-v2.0.0.apk` | Android phones (Android 8+) |
| `AgriAqua360-Windows-x64.zip` | Windows 10/11 (64-bit): unzip and run **AgriAqua 360.exe** |

### Install
- **Android:**
  - Open the APK on the phone and allow "Install unknown apps".
  - It installs over v1.0.0 and keeps your data.
  - If Play Protect warns, tap **More details → Install anyway**. The app is not on the Play Store yet.
- **Windows:** unzip, then run `AgriAqua 360.exe`. If SmartScreen warns, click **More info → Run anyway**. The app is not code-signed yet.

### New in Level 2
- **New tabs:** Home · Monitor · Sahayak · Insights · Profile.
- **All 80 Level 2 designs:** each has its own working screen.
- **Sensors (ESP32, HTTPS or MQTT):**
  - live dashboards, history charts, alert limits and calibration;
  - offline-device alerts;
  - a built-in **simulator**, whose data is always labelled SIMULATED.
- **Pumps, aerators and valves:**
  - start and stop with a confirmation step;
  - a maximum run time enforced on the device;
  - the manual switch always wins over the app;
  - automation rules that are off until you turn them on.
- **Weather:**
  - Open-Meteo forecast (48 hours hourly, 7 days daily) with evaporation (ET0);
  - spray windows and pond oxygen warnings;
  - NASA POWER rainfall and temperature history compared with last year.
- **Crops and soil:**
  - soil health from lab tests, live sensors and SoilGrids estimates, each clearly labelled;
  - irrigation advice (FAO-56);
  - growth stages, harvest readiness and a harvest planner based on the weather;
  - yield estimates, pest and disease risk, and crop protection;
  - field boundary drawing with Sentinel-2 NDVI.
- **Fish:** live water quality, feeding advice, growth, mortality, pond performance (survival, biomass, FCR) and oxygen trend predictions.
- **Livestock:** milk, weight, feeding and breeding records; collars with fever, activity and rumination alerts; GPS safe areas.
- **Market:**
  - AGMARKNET mandi prices, comparisons and price alerts;
  - a harvest-time **price range** with uncertainty (never a promised price).
  - This is information only: nothing is bought or sold in the app.
- **Money and support:** farm income and costs, profit per crop, pond and animal, a break-even estimator, government schemes, an eligibility checker, insurance help and application guidance.
- **AI (Gemini):** checks of your own data for water, soil, crops, livestock, money and crop planning. It is labelled as preliminary guidance.
- **Offline:**
  - new records are saved without internet and sync automatically when you're back online;
  - saved data is shown with how old it is.
- **Notification settings:** for each category; alerts are written in your language.

### Still to be connected by the owner
Live mandi prices need a data.gov.in key. Satellite NDVI needs a Copernicus key. Phone push for sensor alerts needs an FCM key uploaded to Expo. Until then those screens say "not connected", and alerts still appear inside the app.

### Known limits
- **AI:** the free Gemini tier can briefly answer "AI busy" during heavy use.
- **Hardware:** the ESP32 firmware has been checked for build errors but not yet tested on real hardware. Calibrate sensors against a reference meter.
- **Estimates:** AI results, yield estimates and price outlooks are estimates. Consult experts for important decisions.
