module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['scanner', 'schema', 'watcher', 'ui', 'types', 'deps', 'ci', 'docs', 'release'],
    ],
  },
};
