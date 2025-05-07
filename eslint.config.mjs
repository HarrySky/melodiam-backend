// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import eslintPluginImportX from 'eslint-plugin-import-x';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
// @ts-ignore
import * as drizzle from 'eslint-plugin-drizzle';

export default tseslint.config(
  {
    // config with just ignores is the replacement for `.eslintignore`
    ignores: ['**/build/**', '**/dist/**'],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      eslintPluginPrettierRecommended,
      eslintPluginImportX.flatConfigs.recommended,
      eslintPluginImportX.flatConfigs.typescript,
    ],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      drizzle: {
        rules: drizzle.rules,
        meta: drizzle.meta,
      },
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: true,
      },
      globals: {
        ...globals.node,
      },
      ecmaVersion: 6,
      sourceType: 'module',
    },
    rules: {
      ...drizzle.configs.recommended.rules,
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        'destructuredArrayIgnorePattern': '^_',
        'ignoreRestSiblings': true,
      }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'max-len': ['error', { 'code': 88, 'ignoreUrls': true }],
      'no-await-in-loop': 'error',
      'eqeqeq': ['error', 'smart'],
      'complexity': ['warn', 5],
      'no-console': 'warn',
      'no-unused-expressions': ['error', { 'allowTernary': true }],
      'yoda': 'error',
      'no-warning-comments': ['error', { 'terms': ["fixme"] } ],
      'import-x/no-unresolved': 'error',
      'import-x/order': [
        'error',
        {
          // Built-in imports (come from NodeJS native) go first, then external and our
          groups: [
            'builtin', 
            'external',
            'internal',
            ['sibling', 'parent'],
            'index',
            'unknown',
          ],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: false,
          },
        },
      ],
    },
    settings: {
      'import-x/resolver': {
        typescript: true
      }
    }
  },
  {
    // disable type-aware linting on JS files
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  }
);