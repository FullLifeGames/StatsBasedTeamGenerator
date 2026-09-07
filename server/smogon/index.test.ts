import {gzipSync} from 'node:zlib';
import {describe, expect, it, vi} from 'vitest';
import {
  SmogonRequestError,
  decodeStatsPayload,
  discoverMonthFormats,
  discoverStatsIndex,
  fetchStatsFile,
  parseChaosListing,
  parseMonthListing
} from './index';

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

const gzippedChaosHtml = `
  <a href="gen9ou-0.json.gz">gen9ou-0.json.gz</a>
  <a href="gen9ou-1500.json.gz">gen9ou-1500.json.gz</a>
  <a href="gen9doublesou-1825.json.gz">gen9doublesou-1825.json.gz</a>
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

  it('groups gzipped chaos files by format and cutoff', () => {
    expect(parseChaosListing(gzippedChaosHtml, '2026-03')).toEqual([
      {id: 'gen9doublesou', name: 'Gen 9 Doubles OU', month: '2026-03', cutoffs: [1825]},
      {id: 'gen9ou', name: 'Gen 9 OU', month: '2026-03', cutoffs: [0, 1500]}
    ]);
  });

  it('counts a cutoff once when a listing carries both file names', () => {
    const mixed = `
      <a href="gen9ou-1500.json">gen9ou-1500.json</a>
      <a href="gen9ou-1500.json.gz">gen9ou-1500.json.gz</a>
    `;

    expect(parseChaosListing(mixed, '2026-03')).toEqual([
      {id: 'gen9ou', name: 'Gen 9 OU', month: '2026-03', cutoffs: [1500]}
    ]);
  });

  it('reads the format id from a listing that links by path', () => {
    const absolute = '<a href="/stats/2026-03/chaos/gen9ou-1825.json.gz">gen9ou-1825.json.gz</a>';

    expect(parseChaosListing(absolute, '2026-03')).toEqual([
      {id: 'gen9ou', name: 'Gen 9 OU', month: '2026-03', cutoffs: [1825]}
    ]);
  });

  it('bypasses the runtime cache for injected fetchers', async () => {
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
    expect(firstFetcher).toHaveBeenCalledTimes(2);
    expect(secondFetcher).toHaveBeenCalledTimes(2);
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

describe('gzipped Smogon payloads', () => {
  it('inflates a payload that arrives still compressed', () => {
    expect(decodeStatsPayload(gzipSync(Buffer.from('| 1 | Jynx | 22.6% |', 'utf8')))).toBe('| 1 | Jynx | 22.6% |');
  });

  it('passes an uncompressed payload straight through', () => {
    expect(decodeStatsPayload(new TextEncoder().encode('{"data":{}}'))).toBe('{"data":{}}');
  });

  it('reads an empty payload without inflating it', () => {
    expect(decodeStatsPayload(new ArrayBuffer(0))).toBe('');
  });
});

describe('stats file fallback', () => {
  const leadsUrl = 'https://www.smogon.com/stats/2026-03/leads/gen1ou-1760.txt';

  it('reads the uncompressed file when Smogon still publishes it', async () => {
    const fetcher = vi.fn(async () => 'plain');

    await expect(fetchStatsFile(leadsUrl, fetcher)).resolves.toBe('plain');
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(leadsUrl);
  });

  it('falls back to the gzipped file when the uncompressed name is gone', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url !== `${leadsUrl}.gz`) throw new SmogonRequestError(url, 404);
      return 'from gzip';
    });

    await expect(fetchStatsFile(leadsUrl, fetcher)).resolves.toBe('from gzip');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('reports the uncompressed name when neither file resolves', async () => {
    const fetcher = vi.fn(async (url: string) => {
      throw new SmogonRequestError(url, 404);
    });

    await expect(fetchStatsFile(leadsUrl, fetcher)).rejects.toThrow(`Smogon request failed 404: ${leadsUrl}`);
  });

  it('does not append a second suffix to a gzipped url', async () => {
    const fetcher = vi.fn(async (url: string) => {
      throw new SmogonRequestError(url, 404);
    });

    await expect(fetchStatsFile(`${leadsUrl}.gz`, fetcher)).rejects.toThrow(SmogonRequestError);
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(`${leadsUrl}.gz`);
  });
});
