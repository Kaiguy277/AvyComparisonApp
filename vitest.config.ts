import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests for the pure logic layers (dates, offline-cache merge/prune,
// the forecast-bundle decision tree, station-timeseries math). This is a
// logic harness, not a device/UI test — the app is iPhone-first and its
// native modules can't run here. Anything that reaches React Native at
// import time is aliased to a stub below.
export default defineConfig({
  resolve: {
    alias: [
      // Project path alias: `@/x` → `<root>/x`.
      { find: /^@\/(.*)$/, replacement: path.resolve(process.cwd(), "$1") },
      // AsyncStorage is a native module; offlineCache imports it at load.
      // Swap in an in-memory stub so the pure functions are testable.
      {
        find: /^@react-native-async-storage\/async-storage$/,
        replacement: path.resolve(process.cwd(), "test/mocks/asyncStorage.ts"),
      },
    ],
  },
  test: {
    // Only the logic layers — keep RN screens/components out.
    include: [
      "lib/**/*.test.ts",
      "hooks/**/*.test.ts",
      "supabase/**/*.test.ts",
    ],
    environment: "node",
  },
});
