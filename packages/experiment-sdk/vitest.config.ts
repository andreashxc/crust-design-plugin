import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'experiment-sdk',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
