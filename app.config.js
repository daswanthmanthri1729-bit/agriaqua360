// google-services.json is git-ignored; on EAS it arrives as the file env var GOOGLE_SERVICES_JSON.
module.exports = ({ config }) => ({
  ...config,
  android: { ...config.android, googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json' },
});
