export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '.local/**'] },
  {
    files: ['**/*.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-constant-condition': 'error',
      'no-unreachable': 'error',
      'no-dupe-keys': 'error',
      'constructor-super': 'error',
      'valid-typeof': 'error',
      eqeqeq: 'error',
    },
  },
];
