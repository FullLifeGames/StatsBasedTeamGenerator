import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  clearApiCaches,
  fetchAnalysisSetTemplates,
  fetchMonthFormats,
  fetchStatsDataset,
  fetchStatsIndex,
  prefetchStatsDataset
} from './api';
import {makeDataset, makePokemon} from '../test/fixtures';
import type {StatsDataset, StatsIndex} from '../domain/types';

function mockFetch(response: Partial<Response> & {json: () => Promise<unknown>}): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
}

describe('stats API client', () => {
  afterEach(() => {
    clearApiCaches();
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

  it('reuses an in-flight stats dataset request for matching month, format, and cutoff', async () => {
    const dataset = makeDataset([makePokemon({id: 'greattusk', name: 'Great Tusk'})]);
    let resolveResponse!: (response: Partial<Response> & {json: () => Promise<StatsDataset>}) => void;
    const responsePromise = new Promise<Partial<Response> & {json: () => Promise<StatsDataset>}>(resolve => {
      resolveResponse = resolve;
    });
    vi.stubGlobal('fetch', vi.fn(() => responsePromise));

    const first = fetchStatsDataset('2026-05', 'gen9ou', 1825);
    const second = fetchStatsDataset('2026-05', 'gen9ou', 1825);
    resolveResponse({ok: true, json: () => Promise.resolve(dataset)});

    await expect(Promise.all([first, second])).resolves.toEqual([dataset, dataset]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/api/stats/2026-05/gen9ou/1825');
  });

  it('lets prefetch warm the stats dataset used by a later fetch', async () => {
    const dataset = makeDataset([makePokemon({id: 'kingambit', name: 'Kingambit'})]);
    mockFetch({ok: true, json: () => Promise.resolve(dataset)});

    prefetchStatsDataset('2026-05', 'gen9ou', 1825);
    await expect(fetchStatsDataset('2026-05', 'gen9ou', 1825)).resolves.toBe(dataset);

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('fetchMonthFormats(month) fetches the selected month index', async () => {
    const formats = [{id: 'gen9ou', name: 'Gen 9 OU', month: '2026-02', cutoffs: [1500]}];
    mockFetch({ok: true, json: () => Promise.resolve(formats)});

    await expect(fetchMonthFormats('2026-02')).resolves.toBe(formats);
    expect(fetch).toHaveBeenCalledWith('/api/stats/index/2026-02');
  });

  it('fetchAnalysisSetTemplates(format, pokemon) posts a batched set request', async () => {
    const templates = {baxcalibur: [{item: 'Loaded Dice', moves: ['Scale Shot', 'Icicle Spear']}]};
    mockFetch({ok: true, json: () => Promise.resolve(templates)});

    await expect(fetchAnalysisSetTemplates('gen9ou', ['Baxcalibur'])).resolves.toBe(templates);
    expect(fetch).toHaveBeenCalledWith('/api/sets/gen9ou', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({pokemon: ['Baxcalibur']})
    });
  });

  it('caches matching analysis set template requests regardless of Pokemon order', async () => {
    const templates = {baxcalibur: [{item: 'Loaded Dice', moves: ['Scale Shot', 'Icicle Spear']}]};
    mockFetch({ok: true, json: () => Promise.resolve(templates)});

    await expect(fetchAnalysisSetTemplates('gen9ou', ['Baxcalibur', 'Garchomp'])).resolves.toBe(templates);
    await expect(fetchAnalysisSetTemplates('gen9ou', ['Garchomp', 'Baxcalibur'])).resolves.toBe(templates);

    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
