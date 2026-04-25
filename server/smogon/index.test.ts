import {describe, expect, it, vi} from 'vitest';
import {discoverStatsIndex, parseChaosListing, parseMonthListing} from './index';

const rootHtml = `
  <a href="2026-02/">2026-02/</a>
  <a href="2026-03/">2026-03/</a>
`;

const chaosHtml = `
  <a href="gen9ou-0.json">gen9ou-0.json</a>
  <a href="gen9ou-1500.json">gen9ou-1500.json</a>
  <a href="gen9ou-1825.json">gen9ou-1825.json</a>
  <a href="gen9doublesou-0.json">gen9doublesou-0.json</a>
  <a href="gen9doublesou-1825.json">gen9doublesou-1825.json</a>
`;

describe('Smogon index discovery', () => {
  it('parses and sorts months newest first', () => {
    expect(parseMonthListing(rootHtml)).toEqual(['2026-03', '2026-02']);
  });

  it('groups chaos files by format and cutoff', () => {
    expect(parseChaosListing(chaosHtml, '2026-03')).toEqual([
      {id: 'gen9doublesou', name: 'Gen 9 Doubles OU', month: '2026-03', cutoffs: [0, 1825]},
      {id: 'gen9ou', name: 'Gen 9 OU', month: '2026-03', cutoffs: [0, 1500, 1825]}
    ]);
  });

  it('fetches the latest index from Smogon', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url === 'https://www.smogon.com/stats/') return rootHtml;
      if (url === 'https://www.smogon.com/stats/2026-03/chaos/') return chaosHtml;
      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(discoverStatsIndex(fetcher)).resolves.toMatchObject({
      latestMonth: '2026-03',
      months: ['2026-03', '2026-02'],
      formats: [
        {id: 'gen9doublesou', cutoffs: [0, 1825]},
        {id: 'gen9ou', cutoffs: [0, 1500, 1825]}
      ]
    });
  });
});
