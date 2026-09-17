const { withInfoPlist } = require("expo/config-plugins");

// Trims Info.plist keys that Expo's own plugins add unconditionally but this
// app has no feature for. A declared permission with nothing behind it is
// what got build 32 rejected under Guideline 2.5.4, so the plist must claim
// only what Whumpf actually does.
//
// Currently that is the microphone string from expo-image-picker: both
// pickers are mediaTypes: ["images"] (components/observation/PhotoPicker.tsx,
// components/trip/PhotoField.tsx) so the mic is never used, and the plugin
// offers no way to omit it.
//
// NOTE: this used to strip NSLocationAlways* and the "location" background
// mode as well. It must NOT any more — as of 1.1 the app has live trip
// tracking (lib/tripPlan/tracking.ts), a real persistent-location feature,
// and those keys are required for it. Re-adding that stripping would
// silently break tracking.
//
// ORDERING GOTCHA: this plugin must be listed FIRST in app.json's plugins
// array. Expo composes withInfoPlist mods last-registered-first, so the
// FIRST-listed plugin runs LAST — which is what lets this one delete keys
// the permission plugins added. Listed later, it runs before them and sees
// a modResults with nothing to delete. Verified end to end with
// `npx expo config --type introspect`, not by reading the config.
module.exports = function withTrimmedPermissions(config) {
  return withInfoPlist(config, (config) => {
    delete config.modResults.NSMicrophoneUsageDescription;
    return config;
  });
};
