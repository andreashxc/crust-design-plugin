import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildExperiments } from '@platform/build-tools/build-experiments';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const chromeOutDir = resolve(__dirname, '.output/chrome-mv3');

function currentCommit(): string {
  try {
    return execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch {
    return 'local';
  }
}

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Crust',
    description: 'Platform for design experiments',
    version: '0.0.0',
    action: {
      default_title: 'Crust',
      default_icon: {
        16: 'icon/16.png',
        24: 'icon/24.png',
        32: 'icon/32.png',
      },
    },
    permissions: ['storage', 'tabs', 'offscreen', 'scripting'],
    host_permissions: [
      '*://ya.ru/*',
      '*://*.ya.ru/*',
      'https://yandex.ru/*',
      'https://*.yandex.ru/*',
      'https://market.yandex.ru/*',
      'https://weather.yandex.ru/*',
      'https://yandex.ru/pogoda/*',
      'https://api.github.com/repos/andreashxc/crust-design-plugin/compare/*',
    ],
    web_accessible_resources: [
      {
        resources: ['registry.json', 'chunks/experiments-*.js'],
        matches: ['*://ya.ru/*', '*://*.ya.ru/*'],
      },
    ],
  },
  vite: () => ({
    // `buildExperiments` runs at build start: it scans `experiments/*/*/manifest.json`
    // from the repo root, ULID-stamps any empty `id`, runs Zod validation, and enforces
    // manifest.author === <folder name>. Passing `root: repoRoot` is required because
    // Vite's cwd inside this WXT app is `apps/extension/`, not the repo root.
    plugins: [tailwindcss(), buildExperiments({ root: repoRoot, devOutDir: chromeOutDir })],
    define: {
      'import.meta.env.CRUST_CURRENT_COMMIT': JSON.stringify(currentCommit()),
    },
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
