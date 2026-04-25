import {act, renderHook, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {makeDataset, makePokemon} from '../test/fixtures';
import type {StatsDataset, StatsIndex} from '../domain/types';
import {useGenerator} from './useGenerator';

const index: StatsIndex = {
  months: ['2026-02', '2026-03'],
  latestMonth: '2026-03',
  formats: [
    {id: 'gen9ou', name: 'Gen 9 OU', month: '2026-03', cutoffs: [1500, 1825]},
    {id: 'gen91v1', name: 'Gen 9 1v1', month: '2026-03', cutoffs: [1500]}
  ]
};

function testDataset(format: string, cutoff = 1500): StatsDataset {
  return {
    ...makeDataset([
      makePokemon({id: `${format}alpha`, name: `${format} Alpha`, usage: 30}),
      makePokemon({id: `${format}beta`, name: `${format} Beta`, usage: 25}),
      makePokemon({id: `${format}gamma`, name: `${format} Gamma`, usage: 20})
    ]),
    source: {
      month: '2026-03',
      format,
      cutoff,
      url: `https://www.smogon.com/stats/2026-03/chaos/${format}-${cutoff}.json`
    }
  };
}

function lockableDataset(format: string, alphaUsage: number, cutoff = 1500): StatsDataset {
  return {
    ...makeDataset([
      makePokemon({id: `${format}alpha`, name: `${format} Alpha`, usage: alphaUsage}),
      makePokemon({id: `${format}beta`, name: `${format} Beta`, usage: 48}),
      makePokemon({id: `${format}gamma`, name: `${format} Gamma`, usage: 47}),
      makePokemon({id: `${format}delta`, name: `${format} Delta`, usage: 46}),
      makePokemon({id: `${format}epsilon`, name: `${format} Epsilon`, usage: 45})
    ]),
    source: {
      month: '2026-03',
      format,
      cutoff,
      url: `https://www.smogon.com/stats/2026-03/chaos/${format}-${cutoff}.json`
    }
  };
}

function stubFetch(datasets: Record<string, StatsDataset>): void {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url === '/api/stats/index') {
      return {ok: true, json: () => Promise.resolve(index)};
    }

    const dataset = datasets[url];
    if (dataset) {
      return {ok: true, json: () => Promise.resolve(dataset)};
    }

    return {ok: false, json: () => Promise.resolve({message: `Missing fixture for ${url}`})};
  }));
}

describe('useGenerator', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads index and generates a team from mocked fetch responses', async () => {
    stubFetch({'/api/stats/2026-03/gen91v1/1500': testDataset('gen91v1')});
    const {result} = renderHook(() => useGenerator());

    await waitFor(() => expect(result.current.format).toBe('gen9ou'));

    act(() => {
      result.current.setFormat('gen91v1');
    });
    await waitFor(() => expect(result.current.cutoff).toBe(1500));

    await act(async () => {
      await result.current.generate();
    });

    expect(result.current.team?.members.length).toBeGreaterThan(0);
    expect(result.current.team?.source.format).toBe('gen91v1');
  });

  it('keeps cutoff valid when selected format changes and falls back to highest available cutoff', async () => {
    stubFetch({});
    const {result} = renderHook(() => useGenerator());

    await waitFor(() => expect(result.current.cutoff).toBe(1825));

    act(() => {
      result.current.setFormat('gen91v1');
    });

    expect(result.current.cutoff).toBe(1500);
  });

  it('prefers gen9ou as the initial latest-month format when it is listed after other formats', async () => {
    const reversedIndex: StatsIndex = {
      ...index,
      formats: [
        {id: 'gen91v1', name: 'Gen 9 1v1', month: '2026-03', cutoffs: [1500]},
        {id: 'gen9ou', name: 'Gen 9 OU', month: '2026-03', cutoffs: [1500, 1825]}
      ]
    };

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/stats/index') {
        return {ok: true, json: () => Promise.resolve(reversedIndex)};
      }

      return {ok: false, json: () => Promise.resolve({message: `Missing fixture for ${url}`})};
    }));

    const {result} = renderHook(() => useGenerator());

    await waitFor(() => expect(result.current.format).toBe('gen9ou'));
    expect(result.current.cutoff).toBe(1825);
  });

  it('fetches a fresh dataset when month, format, or cutoff changes before generating', async () => {
    stubFetch({
      '/api/stats/2026-03/gen9ou/1825': testDataset('gen9ou', 1825),
      '/api/stats/2026-03/gen91v1/1500': testDataset('gen91v1', 1500)
    });
    const {result} = renderHook(() => useGenerator());

    await waitFor(() => expect(result.current.cutoff).toBe(1825));

    await act(async () => {
      await result.current.generate();
    });

    act(() => {
      result.current.setFormat('gen91v1');
    });

    await act(async () => {
      await result.current.generate();
    });

    expect(fetch).toHaveBeenCalledWith('/api/stats/2026-03/gen9ou/1825');
    expect(fetch).toHaveBeenCalledWith('/api/stats/2026-03/gen91v1/1500');
    expect(result.current.dataset?.source.format).toBe('gen91v1');
    expect(result.current.team?.source.format).toBe('gen91v1');
  });

  it('loads format listings on demand when an older month is selected', async () => {
    const partialIndex: StatsIndex = {
      months: ['2026-02', '2026-03'],
      latestMonth: '2026-03',
      formats: [
        {id: 'gen9ou', name: 'Gen 9 OU', month: '2026-03', cutoffs: [1500, 1825]}
      ]
    };

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/stats/index') {
        return {ok: true, json: () => Promise.resolve(partialIndex)};
      }

      if (url === '/api/stats/index/2026-02') {
        return {
          ok: true,
          json: () => Promise.resolve([
            {id: 'gen9ou', name: 'Gen 9 OU', month: '2026-02', cutoffs: [1500]}
          ])
        };
      }

      return {ok: false, json: () => Promise.resolve({message: `Missing fixture for ${url}`})};
    }));
    const {result} = renderHook(() => useGenerator());

    await waitFor(() => expect(result.current.month).toBe('2026-03'));

    act(() => {
      result.current.setMonth('2026-02');
    });

    await waitFor(() => expect(result.current.availableFormats).toHaveLength(1));
    expect(fetch).toHaveBeenCalledWith('/api/stats/index/2026-02');
    expect(result.current.month).toBe('2026-02');
    expect(result.current.format).toBe('gen9ou');
    expect(result.current.cutoff).toBe(1500);
  });

  it('preserves locked members when regenerating the same selection', async () => {
    const firstDataset = lockableDataset('gen91v1', 50);
    const secondDataset = lockableDataset('gen91v1', 1);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/stats/index') {
        return {ok: true, json: () => Promise.resolve(index)};
      }

      if (url === '/api/stats/2026-03/gen91v1/1500') {
        const dataset = (fetch as ReturnType<typeof vi.fn>).mock.calls.length <= 2
          ? firstDataset
          : secondDataset;
        return {ok: true, json: () => Promise.resolve(dataset)};
      }

      return {ok: false, json: () => Promise.resolve({message: `Missing fixture for ${url}`})};
    }));
    const {result} = renderHook(() => useGenerator());

    await waitFor(() => expect(result.current.format).toBe('gen9ou'));
    act(() => {
      result.current.setFormat('gen91v1');
    });

    await act(async () => {
      await result.current.generate();
    });
    const lockedId = result.current.team?.members[0]?.stats.id;
    expect(lockedId).toBe('gen91v1alpha');

    act(() => {
      result.current.toggleLock(lockedId);
    });

    await act(async () => {
      await result.current.generate();
    });

    expect(result.current.team?.members[0]?.stats.id).toBe(lockedId);
    expect(result.current.team?.members[0]?.locked).toBe(true);
  });

  it('replaces one member while preserving the rest of the generated team', async () => {
    stubFetch({
      '/api/stats/2026-03/gen91v1/1500': lockableDataset('gen91v1', 50)
    });
    const {result} = renderHook(() => useGenerator());

    await waitFor(() => expect(result.current.format).toBe('gen9ou'));
    act(() => {
      result.current.setFormat('gen91v1');
    });

    await act(async () => {
      await result.current.generate();
    });
    const originalIds = result.current.team?.members.map(member => member.stats.id) ?? [];
    const replacedId = originalIds[0];

    await act(async () => {
      await result.current.replaceMember(replacedId);
    });

    const nextIds = result.current.team?.members.map(member => member.stats.id) ?? [];
    expect(nextIds).not.toContain(replacedId);
    expect(nextIds).toContain(originalIds[1]);
    expect(nextIds).toContain(originalIds[2]);
    expect(nextIds).toHaveLength(originalIds.length);
  });
});
