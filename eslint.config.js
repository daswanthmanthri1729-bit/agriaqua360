// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'desktop/app/*', 'desktop/dist/*', 'design_reference/*', 'supabase/functions/*', 'firmware/*', 'web-build/*'],
  },
  {
    // React Compiler readiness rules: this app does not use the compiler, and the "reset form when a sheet opens"
    // effect pattern is intentional. Kept visible as warnings.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
  {
    files: ['desktop/**/*.js', 'tests/**/*.{js,mjs}', '*.config.js'],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
  },
]);
