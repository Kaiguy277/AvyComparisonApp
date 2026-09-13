// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // supabase/functions is Deno (remote https:// imports the RN resolver
    // can't follow → false import/no-unresolved); .expo and graphify-out
    // are generated. deploy/ is the Deno Deploy proxy, same story.
    // tsconfig already excludes supabase + deploy — match it here.
    ignores: [
      'dist/*',
      'supabase/functions/**',
      'deploy/**',
      '.expo/**',
      'graphify-out/**',
      'test/mocks/**',
    ],
  },
]);
