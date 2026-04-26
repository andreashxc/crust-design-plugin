---
phase: 02-state-foundation-messaging-popup-shell
plan: 04
subsystem: build-registry
tags: [registry, chunks, wxt, esbuild, web-accessible-resources]
completed: 2026-04-26
requirements-completed: [BLD-03, BLD-04]
---

# Phase 2 Plan 04: Registry & Experiment Chunk Summary

Implemented build-time `registry.json` emission and resolved the BLD-04 blocker where WXT content scripts are built as IIFEs and cannot use Rollup/Rolldown code splitting.

## Accomplishments

- Extended `tools/build-experiments.ts` to cache `scanAndValidate()` and emit a 9-field `registry.json`.
- Added a fallback chunk emitter using `esbuild.buildSync(...)` for experiment modules, producing web-accessible ESM assets under `chunks/experiments-<author>__<folder>-<hash>.js`.
- Added `chunkPath` in `registry.json` pointing to the generated experiment asset.
- Updated `apps/extension/wxt.config.ts` with `web_accessible_resources` for `registry.json` and `chunks/experiments-*.js`.
- Added registry/chunk tests in `tools/build-experiments.test.ts`.

## Deviations

- Planned `manualChunks` cannot work with WXT 0.20.25 content-script IIFE output:
  - Global `manualChunks` fails because code splitting is disabled for some outputs.
  - Content-script `codeSplitting: true` fails because IIFE output is incompatible with code splitting.
- The accepted implementation emits experiment chunks as separate browser ESM assets from the build plugin and loads them by URL at runtime.

## Verification

- `corepack pnpm vitest run tools/build-experiments.test.ts` — passed.
- `corepack pnpm -F @platform/extension build` — passed.
- Build artifact includes `registry.json` with `chunkPath: "chunks/experiments-andrew__smoke-3416b9b8.js"`.
- Build artifact includes `chunks/experiments-andrew__smoke-3416b9b8.js`.
