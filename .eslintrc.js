module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: {
    react: { version: 'detect' },
  },
  plugins: ['react', 'react-hooks', 'import', 'unused-imports'],
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
  ],
  rules: {
    // React 18 automatic JSX transform — no need to import React
    'react/react-in-jsx-scope': 'off',

    // Enforce PropTypes on all components
    'react/prop-types': 'error',

    // Unused imports — auto-removable via --fix
    'unused-imports/no-unused-imports': 'error',

    // Unused vars (delegated to unused-imports plugin for consistency)
    'no-unused-vars': 'off',
    'unused-imports/no-unused-vars': [
      'warn',
      {
        vars: 'all',
        args: 'after-used',
        ignoreRestSiblings: true,
      },
    ],

    // Import rules
    'import/no-unused-modules': 'warn',
    'import/no-duplicates': 'error',
    'import/order': [
      'warn',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'never',
      },
    ],

    'no-console': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
  },
  overrides: [
    {
      files: ['src/main/**/*.js'],
      env: { browser: false, node: true },
    },
  ],
  ignorePatterns: ['out/', 'node_modules/', 'dist/'],
};