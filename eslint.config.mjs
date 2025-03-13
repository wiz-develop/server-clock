import { essentials, node, typescript } from '@wiz-develop/eslint-config';
import eslintConfigPrettier from 'eslint-config-prettier';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  ...essentials,

  {
    languageOptions: {
      globals: {
        process: true,
        window: true,
        console: true,
        self: true,
      },
    },
  },

  {
    rules: {
      'unicorn/expiring-todo-comments': 'off',
      'import/no-default-export': ['off'],
    },
  },

  ...typescript,
  ...node,

  eslintConfigPrettier,
];
