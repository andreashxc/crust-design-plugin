import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    name: 'extension',
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'entrypoints/**/*.test.ts',
      'entrypoints/**/*.test.tsx',
    ],
    // Default to node for fast pure-logic tests (storage, engine, handlers).
    // Tests that need DOM (popup React components via @testing-library/react)
    // declare per-file:  // @vitest-environment jsdom
    environment: 'node',
    setupFiles: ['./src/test-setup/chrome-mock.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
