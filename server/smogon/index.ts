import {gunzipSync} from 'node:zlib';
import type {FormatListing, StatsIndex} from '../../src/domain/types';
import {readThroughCache} from './cache';

const STATS_ROOT = 'https://www.smogon.com/stats/';
const CACHE_VERSION = 'v3';
const MONTH_PATTERN = /href="(\d{4}-\d{2})\/"/g;
// Smogon now publishes the stats files gzipped, so the same format and cutoff
// can be listed as either `gen9ou-1825.json` or `gen9ou-1825.json.gz`.
const CHAOS_FILE_PATTERN = /href="([^"]+)-(\d+)\.json(?:\.gz)?"/g;
const GZIP_SUFFIX = '.gz';
const decoder = new TextDecoder();

export type TextFetcher = (url: string) => Promise<string>;

export class SmogonRequestError extends Error {
  constructor(readonly url: string, readonly status: number) {
    super(`Smogon request failed ${status}: ${url}`);
    this.name = 'SmogonRequestError';
  }
}

export function parseMonthListing(html: string): string[] {
  return [...html.matchAll(MONTH_PATTERN)]
    .map(match => match[1])
    .sort((a, b) => b.localeCompare(a));
}

export function formatName(formatId: string): string {
  const spaced = formatId
    .replace(/^gen(\d+)/, 'Gen $1 ')
    .replace(/doubles/g, ' __DOUBLES__ ')
    .replace(/nationaldex/g, ' __NATIONAL_DEX__ ')
    .replace(/ou/g, ' OU ')
    .replace(/uu/g, ' UU ')
    .replace(/ru/g, ' RU ')
    .replace(/nu/g, ' NU ')
    .replace(/lc/g, ' LC ')
    .replace(/__DOUBLES__/g, 'Doubles')
    .replace(/__NATIONAL_DEX__/g, 'National Dex')
    .replace(/\s+/g, ' ')
    .trim();
  return spaced || formatId;
}

export function parseChaosListing(html: string, month: string): FormatListing[] {
  const grouped = new Map<string, Set<number>>();
  for (const match of html.matchAll(CHAOS_FILE_PATTERN)) {
    const [, href, cutoff] = match;
    // A listing may link the file by path rather than by name.
    const id = href.slice(href.lastIndexOf('/') + 1);
    if (!grouped.has(id)) grouped.set(id, new Set());
    grouped.get(id)!.add(Number(cutoff));
  }

  return [...grouped.entries()]
    .map(([id, cutoffs]) => ({
      id,
      name: formatName(id),
      month,
      cutoffs: [...cutoffs].sort((a, b) => a - b)
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Smogon stores the stats files gzipped, and the bytes can arrive still
 * compressed either way they are addressed: a `.gz` URL is served as plain
 * `application/gzip`, and a `.txt` URL can carry a content encoding that fetch
 * does not unwrap. Browsers inflate both silently, which is why the pages read
 * fine by hand while the server saw binary, so the gzip header is the only
 * dependable signal that a payload still needs inflating.
 */
export function decodeStatsPayload(payload: ArrayBuffer | Uint8Array): string {
  const bytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  if (bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) return decoder.decode(gunzipSync(bytes));
  return decoder.decode(bytes);
}

export async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new SmogonRequestError(url, response.status);
  return decodeStatsPayload(await response.arrayBuffer());
}

/**
 * Smogon dropped the uncompressed `.txt` and `.json` files from its listings, so
 * a stats file is read from whichever of the two names still resolves. When
 * neither does, the failure is reported against the uncompressed name because
 * that is the resource the caller asked for.
 */
export async function fetchStatsFile(url: string, fetcher: TextFetcher = fetchText): Promise<string> {
  try {
    return await fetcher(url);
  } catch (error) {
    if (url.endsWith(GZIP_SUFFIX)) throw error;

    try {
      return await fetcher(`${url}${GZIP_SUFFIX}`);
    } catch {
      throw error;
    }
  }
}

function textLoader(fetcher: TextFetcher): (key: string, url: string) => Promise<string> {
  const shouldCache = fetcher === fetchText;

  return (key: string, url: string) => {
    if (!shouldCache) return fetcher(url);
    return readThroughCache(key, 15 * 60_000, () => fetcher(url));
  };
}

export async function discoverMonthFormats(
  month: string,
  fetcher: TextFetcher = fetchText
): Promise<FormatListing[]> {
  const loadText = textLoader(fetcher);
  const chaosUrl = `${STATS_ROOT}${month}/chaos/`;
  const chaos = await loadText(`${CACHE_VERSION}:chaos-index:${month}`, chaosUrl);
  return parseChaosListing(chaos, month);
}

export async function discoverStatsIndex(fetcher: TextFetcher = fetchText): Promise<StatsIndex> {
  const loadText = textLoader(fetcher);

  const root = await loadText(`${CACHE_VERSION}:stats-root`, STATS_ROOT);
  const months = parseMonthListing(root);
  if (!months.length) throw new Error('No Smogon stats months found');
  const latestMonth = months[0];
  return {
    months,
    latestMonth,
    formats: await discoverMonthFormats(latestMonth, fetcher)
  };
}
