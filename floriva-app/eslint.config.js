const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    files: ['tests/**/*.{js,jsx,ts,tsx}', 'e2e/**/*.js'],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        afterAll: 'readonly',
        beforeAll: 'readonly',
        by: 'readonly',
        describe: 'readonly',
        device: 'readonly',
        element: 'readonly',
        expect: 'readonly',
        it: 'readonly',
        jest: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // Product code must use theme.radii tokens, never raw radius numbers.
    files: ['src/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}', '**/__tests__/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "Property[key.name='borderRadius'][value.type='Literal'][value.raw=/^[0-9]/]",
          message:
            'Use theme.radii tokens (theme.radii.hairline/xs/sm/md/lg/xl/pill) instead of numeric borderRadius literals. See src/theme/tokens.ts.',
        },
      ],
    },
  },
  {
    ignores: ['coverage/*'],
  },
]);
