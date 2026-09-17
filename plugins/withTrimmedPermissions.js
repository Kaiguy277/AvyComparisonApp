const { withInfoPlist } = require("expo/config-plugins");

// Whumpf only ever requests WHEN IN USE location, and only when the user
// taps "Use current location" on the observation form (components/
// observation/LocationField.tsx). It has no background-location feature.
//
// expo-location's config plugin writes all three NSLocation* usage strings
// unconditionally — any key we don't supply gets its generic default
// ("Allow $(PRODUCT_NAME) to access your location"), with no option to omit
// them (see node_modules/expo-location/plugin/build/withLocation.js:
// createPermissionsPlugin is called with all three keys defaulted).
//
// Leaving the two "Always" keys in Info.plist advertises an authorization
// level the app never asks for. That is what got 1.0 (build 32) rejected
// under Guideline 2.5.4 on 2026-09-17 — Apple looks at the plist to decide
// what the app claims it needs, so the plist must not claim Always.
// ORDERING GOTCHA: this plugin must be listed FIRST in app.json's plugins
// array. Expo composes withInfoPlist mods last-registered-first, so the
// FIRST-listed plugin runs LAST — which is what lets this one delete keys
// the permission plugins added. Listed later, it runs before them and sees
// a modResults with nothing to delete. Verified end to end with
// `npx expo config --type introspect`, not by reading the config.
module.exports = function withTrimmedPermissions(config) {
  return withInfoPlist(config, (config) => {
    delete config.modResults.NSLocationAlwaysUsageDescription;
    delete config.modResults.NSLocationAlwaysAndWhenInUseUsageDescription;

    // expo-image-picker unconditionally adds a microphone string, but both
    // pickers are mediaTypes: ["images"] (components/observation/PhotoPicker
    // .tsx, components/trip/PhotoField.tsx) so the mic is never used. Same
    // defect class as the Always keys: a declared permission with no feature.
    delete config.modResults.NSMicrophoneUsageDescription;

    // Belt and braces: ensure nothing re-added the background mode.
    if (Array.isArray(config.modResults.UIBackgroundModes)) {
      config.modResults.UIBackgroundModes =
        config.modResults.UIBackgroundModes.filter((m) => m !== "location");
    }
    return config;
  });
};
