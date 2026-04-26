import type { ApplyArgs } from '@platform/experiment-sdk';
import { createHelpers } from './helpers';

const validApplyArgs: ApplyArgs = {
  tweaks: {},
  helpers: createHelpers({ experimentId: 'test', log: () => {} }),
  currentURL: 'https://ya.ru/',
  log: () => {},
  signal: new AbortController().signal,
};

void validApplyArgs;

// @ts-expect-error signal is part of the required experiment apply contract.
const missingSignal: ApplyArgs = {
  tweaks: {},
  helpers: createHelpers({ experimentId: 'test', log: () => {} }),
  currentURL: 'https://ya.ru/',
  log: () => {},
};

void missingSignal;
