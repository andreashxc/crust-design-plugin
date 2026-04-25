import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  './apps/*/vitest.config.ts',
  './packages/*/vitest.config.ts',
  // Root-level test patterns (sanity, scripts, tools tests):
  {
    test: {
      name: 'root',
      include: [
        'tests/**/*.test.ts',
        'scripts/**/*.test.ts',
        'tools/**/*.test.ts',
      ],
      environment: 'node',
    },
  },
]);
