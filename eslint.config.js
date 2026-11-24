// ESLint (flat config) for the JavaScript workspace: packages/ and the repository scripts.
// bench/ keeps its own code from the T milestone and is not linted here.

import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['**/node_modules/**', '.venv/**', 'bench/**', 'research/**', 'research_notes/**', 'reports/**', 'docs/**', '.agents/**', '.claude/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.worker, ...globals.node },
    },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
