import payloadEsLintConfig from '@payloadcms/eslint-config'
import stylistic from '@stylistic/eslint-plugin'
import eslintConfigPrettier from 'eslint-config-prettier/flat'
import commentLength from 'eslint-plugin-comment-length'
import tseslint from 'typescript-eslint'

export const defaultESLintIgnores = [
  '**/.temp',
  '**/.*',
  '**/.git',
  '**/.hg',
  '**/.pnp.*',
  '**/.svn',
  '**/playwright.config.ts',
  '**/next-env.d.ts',
  '**/vitest.config.js',
  '**/tsconfig.tsbuildinfo',
  '**/README.md',
  '**/eslint.config.js',
  '**/payload-types.ts',
  '**/admin/importMap.js',
  '**/migrations/**',
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
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      ...extraStrictRules,

      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
          disallowTypeAnnotations: true,
        },
      ],
      '@typescript-eslint/consistent-type-exports': [
        'error',
        {
          fixMixedExportsWithInlineTypeSpecifier: true,
        },
      ],

      '@typescript-eslint/no-floating-promises': [
        'error',
        {
          ignoreVoid: true,
          ignoreIIFE: true,
        },
      ],
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksConditionals: true,
          checksVoidReturn: {
            attributes: false,
            arguments: true,
          },
        },
      ],

      '@typescript-eslint/no-unnecessary-condition': [
        'error',
        {
          allowConstantLoopConditions: 'always',
        },
      ],
      '@typescript-eslint/strict-boolean-expressions': [
        'error',
        {
          allowString: false,
          allowNumber: false,
          allowNullableObject: true,
          allowNullableBoolean: true,
          allowNullableString: false,
          allowAny: false,
        },
      ],

      '@typescript-eslint/explicit-module-boundary-types': 'error',

      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        {
          considerDefaultExhaustiveForUnions: true,
          requireDefaultForNonUnion: true,
        },
      ],
      '@typescript-eslint/prefer-nullish-coalescing': [
        'error',
        {
          ignoreConditionalTests: false,
          ignoreMixedLogicalExpressions: false,
        },
      ],
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        {
          allowNumber: true,
          allowBoolean: false,
          allowAny: false,
          allowNullish: false,
          allowRegExp: false,
        },
      ],

      '@typescript-eslint/no-explicit-any': [
        'error',
        {
          fixToUnknown: true,
          ignoreRestArgs: false,
        },
      ],
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',

      'no-nested-ternary': 'error',
      'no-unneeded-ternary': ['error', { defaultAssignment: false }],
      'max-depth': ['error', 3],
      'max-nested-callbacks': ['error', 3],
      '@typescript-eslint/max-params': ['error', { max: 4 }],
      complexity: ['error', { max: 15 }],
      'max-statements': ['error', { max: 30 }],
      'max-lines-per-function': [
        'error',
        { max: 80, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],

      'no-async-promise-executor': 'error',
      'no-promise-executor-return': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': [
        'error',
        {
          builtinGlobals: false,
          hoist: 'all',
          allow: ['resolve', 'reject', 'done', 'cb'],
        },
      ],

      'import-x/no-cycle': ['error', { maxDepth: 4 }],
    },
  },

  {
    files: ['src/**/*.{ts,tsx}'],
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

  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}', 'dev/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSAsExpression',
          message: 'Type assertions are forbidden; validate or narrow the value instead.',
        },
        {
          selector: 'TSTypeAssertion',
          message: 'Type assertions are forbidden; validate or narrow the value instead.',
        },
        {
          selector: 'TSNonNullExpression',
          message: 'Non-null assertions are forbidden; handle the missing case explicitly.',
        },
      ],
    },
  },

  {
    files: ['src/**/*.tsx'],
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      '@eslint-react/hooks-extra/no-direct-set-state-in-use-effect': 'error',
      '@eslint-react/hooks-extra/no-useless-custom-hooks': 'error',
      '@eslint-react/hooks-extra/prefer-use-state-lazy-initialization': 'error',
      'max-lines-per-function': [
        'error',
        { max: 150, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
    },
  },

  {
    files: ['src/**/*.{ts,tsx,js,mjs}'],
    rules: {
      'perfectionist/sort-imports': [
        'error',
        {
          type: 'natural',
          order: 'asc',
          ignoreCase: true,
          specialCharacters: 'keep',
          sortSideEffects: false,
          newlinesBetween: 'always',
          groups: [
            'side-effect',
            'side-effect-style',
            ['builtin-type', 'builtin'],
            ['react', 'next', 'payload'],
            ['external-type', 'external'],
            ['internal-type', 'internal'],
            ['parent-type', 'parent'],
            ['sibling-type', 'sibling'],
            ['index-type', 'index'],
            'style',
            'unknown',
          ],
          customGroups: {
            value: {
              react: ['^react(-dom)?(/.*)?$'],
              next: ['^next(/.*)?$'],
              payload: ['^(@payloadcms/|payload($|/))'],
            },
          },
        },
      ],
      'perfectionist/sort-named-imports': [
        'error',
        {
          type: 'natural',
          order: 'asc',
          ignoreCase: true,
          ignoreAlias: false,
          groupKind: 'values-first',
        },
      ],
      'perfectionist/sort-exports': [
        'error',
        {
          type: 'natural',
          order: 'asc',
          ignoreCase: true,
        },
      ],
      'perfectionist/sort-named-exports': [
        'error',
        {
          type: 'natural',
          order: 'asc',
          ignoreCase: true,
          groupKind: 'values-first',
        },
      ],
      'perfectionist/sort-jsx-props': [
        'error',
        {
          type: 'natural',
          order: 'asc',
          ignoreCase: true,
          groups: ['shorthand', 'unknown', 'multiline', 'callback'],
          customGroups: {
            callback: '^on[A-Z].*',
          },
        },
      ],
      'perfectionist/sort-union-types': [
        'error',
        {
          type: 'natural',
          order: 'asc',
          ignoreCase: true,
        },
      ],
      'perfectionist/sort-intersection-types': [
        'error',
        {
          type: 'natural',
          order: 'asc',
          ignoreCase: true,
        },
      ],
      'perfectionist/sort-enums': [
        'error',
        {
          type: 'natural',
          order: 'asc',
          ignoreCase: true,
        },
      ],
    },
  },

  eslintConfigPrettier,

  {
    files: ['src/**/*.{ts,tsx}', 'dev/**/*.{ts,tsx}'],
    plugins: {
      '@stylistic': stylistic,
    },
    rules: {
      '@stylistic/lines-between-class-members': [
        'error',
        'always',
        {
          exceptAfterSingleLine: true,
          exceptAfterOverload: true,
        },
      ],
      '@stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: 'directive', next: '*' },
        { blankLine: 'any', prev: 'directive', next: 'directive' },

        { blankLine: 'always', prev: ['import', 'cjs-import'], next: '*' },
        { blankLine: 'any', prev: ['import', 'cjs-import'], next: ['import', 'cjs-import'] },

        { blankLine: 'always', prev: '*', next: 'return' },

        { blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
        { blankLine: 'any', prev: ['const', 'let', 'var'], next: ['const', 'let', 'var'] },

        { blankLine: 'always', prev: ['type', 'interface', 'enum'], next: '*' },
        { blankLine: 'always', prev: '*', next: ['type', 'interface', 'enum'] },
        {
          blankLine: 'any',
          prev: ['type', 'interface', 'enum'],
          next: ['type', 'interface', 'enum'],
        },

        {
          blankLine: 'always',
          prev: '*',
          next: [
            'multiline-block-like',
            'multiline-const',
            'multiline-expression',
            'multiline-let',
          ],
        },
        {
          blankLine: 'always',
          prev: [
            'multiline-block-like',
            'multiline-const',
            'multiline-expression',
            'multiline-let',
          ],
          next: '*',
        },

        { blankLine: 'always', prev: '*', next: ['function', 'class'] },
        { blankLine: 'always', prev: ['function', 'class'], next: '*' },

        { blankLine: 'always', prev: '*', next: 'export' },
        { blankLine: 'always', prev: 'export', next: '*' },
        { blankLine: 'any', prev: 'export', next: 'export' },

        { blankLine: 'never', prev: 'function-overload', next: 'function-overload' },
        {
          blankLine: 'never',
          prev: 'function-overload',
          next: ['function', 'multiline-block-like'],
        },
      ],
    },
  },

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
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['src/**/*.test.{ts,tsx}', 'tests/**/*.{ts,tsx}', 'dev/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.test.json',
        projectService: false,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
]
