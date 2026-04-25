import { defineConfig } from 'vitest/config';

/**
 * Vitest 4 root config — uses `test.projects` to aggregate per-package configs.
 * (Replaces Vitest 1-3's defineWorkspace + vitest.workspace.ts pattern, which
 *  was removed in Vitest 4.)
 */
export default defineConfig({
  test: {
    projects: [
      './apps/*/vitest.config.ts',
      './packages/*/vitest.config.ts',
      // Root-level test patterns (sanity, scripts, tools tests):
      {
        test: {
          name: 'root',
          include: ['tests/**/*.test.ts', 'scripts/**/*.test.ts', 'tools/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
});
