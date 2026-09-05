// @ts-check

import payloadEsLintConfig from '@payloadcms/eslint-config'
import eslintConfigPrettier from 'eslint-config-prettier/flat'
import commentLength from 'eslint-plugin-comment-length'
import tseslint from 'typescript-eslint'

export const defaultESLintIgnores = [
  '**/.temp',
  '**/.*', // ignore all dotfiles
  '**/.git',
  '**/.hg',
  '**/.pnp.*',
  '**/.svn',
  '**/playwright.config.ts',
  '**/vitest.config.js',
  '**/tsconfig.tsbuildinfo',
  '**/README.md',
  '**/eslint.config.js',
  '**/payload-types.ts',
  '**/dist/',
  '**/.yarn/',
  '**/build/',
  '**/node_modules/',
  '**/temp/',
]

const extraStrictRules = [
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
].reduce((rules, config) => ({ ...rules, ...config.rules }), {})

export default [
  { ignores: defaultESLintIgnores },
  ...payloadEsLintConfig,
  {
    files: ['src/**/*.ts'],
    rules: extraStrictRules,
  },
  {
    files: ['src/**/*.ts'],
    plugins: { 'comment-length': commentLength },
    rules: {
      'comment-length/limit-single-line-comments': [
        'error',
        { maxLength: 80, ignoreUrls: true, ignoreCommentsWithCode: true },
      ],
      'comment-length/limit-multi-line-comments': [
        'error',
        { maxLength: 80, ignoreUrls: true, ignoreCommentsWithCode: true },
      ],
    },
  },
  // Re-applied last so type-checked rule sets above can never reintroduce a
  // formatting rule that conflicts with Prettier.
  eslintConfigPrettier,
  {
    rules: {
      'no-restricted-exports': 'off',
    },
  },
  {
    languageOptions: {
      parserOptions: {
        sourceType: 'module',
        ecmaVersion: 'latest',
        projectService: {
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 40,
          allowDefaultProject: ['scripts/*.ts', '*.js', '*.mjs', '*.spec.ts', '*.d.ts'],
        },
        // projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
]
