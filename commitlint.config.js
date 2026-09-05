export default {
  extends: ['@commitlint/config-conventional'],
  parserPreset: {
    parserOpts: {
      headerPattern:
        /^(\p{Extended_Pictographic}(?:‍\p{Extended_Pictographic})*)\s+(\w+)(?:\(([^)]+)\))?!?: (.+)$/u,
      headerCorrespondence: ['gitmoji', 'type', 'scope', 'subject'],
    },
  },
  plugins: [
    {
      rules: {
        'gitmoji-empty': ({ gitmoji }) => [
          Boolean(gitmoji),
          'commit message must start with a gitmoji, e.g. "✨ feat: add branch collection" (see https://gitmoji.dev)',
        ],
      },
    },
  ],
  rules: {
    'gitmoji-empty': [2, 'always'],
    'header-max-length': [2, 'always', 100],
  },
}
