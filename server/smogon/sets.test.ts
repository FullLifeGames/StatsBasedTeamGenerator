import {afterEach, describe, expect, it, vi} from 'vitest';
import {fetchAnalysisSetTemplates} from './sets';
import type {readThroughCache} from './cache';

const passthroughCache: typeof readThroughCache = async (_key, _ttlMs, loader) => loader();

describe('fetchAnalysisSetTemplates', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns empty templates when optional upstream format set data is missing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 404,
      text: () => Promise.resolve('Not found')
    })));

    await expect(fetchAnalysisSetTemplates(
      'gen9championsvgc2026regmbbo3',
      ['Great Tusk'],
      passthroughCache
    )).resolves.toEqual({greattusk: []});
  });
});
