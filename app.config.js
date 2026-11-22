const fs = require('fs');

// google-services.json is git-ignored. Locally / via .easignore it's a file; on EAS it can also come from the
// file env var GOOGLE_SERVICES_JSON. Without either, build without FCM instead of failing.
const googleServicesFile = process.env.GOOGLE_SERVICES_JSON ?? (fs.existsSync('./google-services.json') ? './google-services.json' : undefined);

module.exports = ({ config }) => ({
  ...config,
  android: { ...config.android, googleServicesFile },
});
