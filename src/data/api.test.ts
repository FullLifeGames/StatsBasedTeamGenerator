import {afterEach, describe, expect, it, vi} from 'vitest';
import {fetchMonthFormats, fetchStatsDataset, fetchStatsIndex} from './api';
import type {StatsIndex} from '../domain/types';

function mockFetch(response: Partial<Response> & {json: () => Promise<unknown>}): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
}

describe('stats API client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetchStatsIndex() fetches /api/stats/index and returns JSON', async () => {
    const index: StatsIndex = {
      months: ['2026-03'],
      latestMonth: '2026-03',
      formats: [{id: 'gen91v1', name: 'Gen 9 1v1', month: '2026-03', cutoffs: [1500]}]
    };
    mockFetch({ok: true, json: () => Promise.resolve(index)});

    await expect(fetchStatsIndex()).resolves.toBe(index);
    expect(fetch).toHaveBeenCalledWith('/api/stats/index');
  });

  it('fetchStatsDataset(month, format, cutoff) throws a readable API error when response message JSON exists', async () => {
    mockFetch({
      ok: false,
      status: 502,
      json: () => Promise.resolve({message: 'Smogon is having a moment'})
    });

    await expect(fetchStatsDataset('2026-03', 'gen91v1', 1500)).rejects.toThrow('Smogon is having a moment');
  });

  it('fetchMonthFormats(month) fetches the selected month index', async () => {
    const formats = [{id: 'gen9ou', name: 'Gen 9 OU', month: '2026-02', cutoffs: [1500]}];
    mockFetch({ok: true, json: () => Promise.resolve(formats)});

    await expect(fetchMonthFormats('2026-02')).resolves.toBe(formats);
    expect(fetch).toHaveBeenCalledWith('/api/stats/index/2026-02');
  });
});
