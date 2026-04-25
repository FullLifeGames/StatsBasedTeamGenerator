import {describe, expect, it, vi} from 'vitest';
import crypto from 'node:crypto';
import {rm, stat} from 'node:fs/promises';
import path from 'node:path';
import {discoverMonthFormats, discoverStatsIndex, parseChaosListing, parseMonthListing} from './index';

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

function cachePathFor(key: string): string {
  return path.resolve(
    process.cwd(),
    '.cache',
    'smogon',
    `${crypto.createHash('sha1').update(key).digest('hex')}.txt`
  );
}

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

  it('bypasses the runtime cache for injected fetchers', async () => {
    const runtimeRootCachePath = cachePathFor('stats-root');
    await rm(runtimeRootCachePath, {force: true});

    const firstFetcher = vi.fn(async (url: string) => {
      if (url === 'https://www.smogon.com/stats/') return rootHtml;
      if (url === 'https://www.smogon.com/stats/2026-03/chaos/') return chaosHtml;
      throw new Error(`Unexpected URL ${url}`);
    });
    const secondFetcher = vi.fn(async (url: string) => {
      if (url === 'https://www.smogon.com/stats/') return '<a href="2027-01/">2027-01/</a>';
      if (url === 'https://www.smogon.com/stats/2027-01/chaos/') {
        return '<a href="gen9ubers-0.json">gen9ubers-0.json</a>';
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    await discoverStatsIndex(firstFetcher);
    await expect(discoverStatsIndex(secondFetcher)).resolves.toMatchObject({
      latestMonth: '2027-01',
      formats: [{id: 'gen9ubers', cutoffs: [0]}]
    });
    await expect(stat(runtimeRootCachePath)).rejects.toMatchObject({code: 'ENOENT'});
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

  it('fetches chaos formats for a requested older month', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url === 'https://www.smogon.com/stats/2026-02/chaos/') {
        return '<a href="gen9ou-1500.json">gen9ou-1500.json</a>';
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(discoverMonthFormats('2026-02', fetcher)).resolves.toEqual([
      {id: 'gen9ou', name: 'Gen 9 OU', month: '2026-02', cutoffs: [1500]}
    ]);
  });
});
