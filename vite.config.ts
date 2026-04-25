import react from '@vitejs/plugin-react';
import type {UserConfig} from 'vite';
import {defineConfig} from 'vite';
import type {InlineConfig} from 'vitest/node';

const config: UserConfig & {test: InlineConfig} = {
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8787'
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    passWithNoTests: true,
    setupFiles: './src/test/setup.ts'
  }
};

export default defineConfig(config);
