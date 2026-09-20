module.exports = {
  root: true,
  env: { es2022: true, node: true },
  parserOptions: { ecmaVersion: 2022, sourceType: 'script' },
  extends: ['eslint:recommended'],
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^next$|^req$|^res$' }],
    'no-console': 'off',
    'prefer-const': 'warn',
    eqeqeq: ['warn', 'smart'],
  },
  overrides: [
    {
      files: ['test/**/*.js'],
      env: { node: true },
    },
  ],
};
