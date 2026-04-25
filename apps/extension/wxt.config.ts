import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Designer Experiment Platform',
    description: 'Phase 1 foundation skeleton',
    version: '0.0.0',
    permissions: ['storage', 'tabs'],
    host_permissions: ['*://ya.ru/*', '*://*.ya.ru/*'],
  },
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        // `@/*` resolves to apps/extension/src/* — WXT/Vite does NOT auto-honor
        // tsconfig.json `paths`, so the alias is duplicated here for runtime.
        // Order matters: more specific prefix `@/` MUST come before `@experiments`.
        '@/': `${resolve(__dirname, 'src')}/`,
        '@experiments': resolve(repoRoot, 'experiments'),
      },
    },
  }),
});
