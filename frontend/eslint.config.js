import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // Build output + vendored assets are not linted.
  { ignores: ['dist', '../Backend/staticfiles/**', 'node_modules'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    // Pragmatic ruleset for this existing codebase. We deliberately do NOT pull
    // in the latest react-hooks RC's aggressive rules (set-state-in-effect,
    // purity, immutability) — they flag pervasive, valid patterns (setState in
    // effects, etc.) and would bury real signal. We keep the genuinely valuable
    // rules and relax stylistic ones to match existing conventions.
    rules: {
      'react-hooks/rules-of-hooks': 'error',        // real bugs (conditional hooks)
      'react-hooks/exhaustive-deps': 'warn',        // advisory
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }], // `catch {}` silent-degrade is intentional
    },
  },
)
