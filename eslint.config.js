import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const nodeOnlyGlobals = Object.keys(globals.node)
  .filter((name) => !(name in globals.browser))
  .map((name) => ({
    name,
    message: 'Node globals are not available in client source files.'
  }));

export default tseslint.config(
  {
    ignores: [
      '**/.cache/**',
      '**/.codex-logs/**',
      '**/.worktrees/**',
      '**/coverage/**',
      '**/dist/**',
      '**/node_modules/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser
    },
    rules: {
      'no-restricted-globals': ['error', ...nodeOnlyGlobals]
    }
  },
  {
    files: ['server/**/*.{ts,tsx}', 'vite.config.ts', 'eslint.config.js'],
    languageOptions: {
      globals: globals.node
    }
  }
);
