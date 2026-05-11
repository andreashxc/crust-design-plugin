# Load The Crust Extension

Use the root-level extension link during local development.

1. Run:

```sh
corepack pnpm dev
```

2. Open Chrome:

```text
chrome://extensions
```

3. Enable Developer mode.

4. Click **Load unpacked**.

5. Select:

```text
./crust-extension
```

`crust-extension/` is a repo-root symlink or Windows junction to the actual WXT Chrome MV3 output under `apps/extension/.output/chrome-mv3`.

Packaged output is created by:

```sh
corepack pnpm build:extension
```

That writes:

```text
dist/crust-chrome-mv3/
dist/crust-chrome-mv3.zip
```

When you add an experiment for a new domain, rebuild and reload the extension. Chrome permissions and content script matches are fixed in `manifest.json`, so Crust generates them from `experiments/*/*/manifest.json` during dev/build.
