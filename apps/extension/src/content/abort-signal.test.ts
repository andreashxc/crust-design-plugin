import { describe, expect, it } from 'vitest';
import { isAbortError } from './engine';

describe('cleanup abort handling', () => {
  it('treats AbortError as expected cleanup cancellation', () => {
    expect(isAbortError(new DOMException('aborted', 'AbortError'))).toBe(true);
  });

  it('does not hide ordinary cleanup errors', () => {
    expect(isAbortError(new Error('cleanup failed'))).toBe(false);
  });
});
