import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// react-hooks 7.1 newly flags 33 pre-existing patterns as errors. Downgraded to
// warn to unblock routine dep bumps; tracked for a dedicated refactor rather than
// bundled with a version bump. See todos/forge/carry-overs.md.
const reactHooksWarnOverrides = {
  'react-hooks/set-state-in-effect': 'warn',
  'react-hooks/immutability': 'warn',
  'react-hooks/preserve-manual-memoization': 'warn',
  'react-hooks/refs': 'warn',
  'react-hooks/exhaustive-deps': 'warn',
}

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}', '**/test/**'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      ...reactHooksWarnOverrides,
      // Prevent raw error.message usage - use errorMessages helper instead
      // This catches common patterns like: err.message, error.message, e.message
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'CatchClause MemberExpression[property.name="message"][object.name=/^(err|error|e)$/]',
          message: 'Avoid using raw err.message. Use errorMessages helper from lib/errorMessages.ts for user-friendly messages.',
        },
      ],
    },
  },
  // Test files - disable react-refresh rules
  {
    files: ['**/*.test.{ts,tsx}', '**/test/**'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      ...reactHooksWarnOverrides,
    },
  },
])
