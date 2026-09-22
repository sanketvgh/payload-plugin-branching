export default {
  extends: ['@commitlint/config-conventional', 'gitmoji'],
  rules: {
    'header-max-length': [2, 'always', 100],
  },
}
