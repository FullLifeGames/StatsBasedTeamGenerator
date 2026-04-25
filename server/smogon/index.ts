import type {FormatListing, StatsIndex} from '../../src/domain/types';
import {readThroughCache} from './cache';

const STATS_ROOT = 'https://www.smogon.com/stats/';
const MONTH_PATTERN = /href="(\d{4}-\d{2})\/"/g;
const CHAOS_FILE_PATTERN = /href="([^"]+)-(\d+)\.json"/g;

export type TextFetcher = (url: string) => Promise<string>;

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
    const [, id, cutoff] = match;
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

export async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Smogon request failed ${response.status}: ${url}`);
  return response.text();
}

export async function discoverStatsIndex(fetcher: TextFetcher = fetchText): Promise<StatsIndex> {
  const shouldCache = fetcher === fetchText;
  const loadText = (key: string, url: string) => {
    if (!shouldCache) return fetcher(url);
    return readThroughCache(key, 15 * 60_000, () => fetcher(url));
  };

  const root = await loadText('stats-root', STATS_ROOT);
  const months = parseMonthListing(root);
  if (!months.length) throw new Error('No Smogon stats months found');
  const latestMonth = months[0];
  const chaosUrl = `${STATS_ROOT}${latestMonth}/chaos/`;
  const chaos = await loadText(`chaos-index:${latestMonth}`, chaosUrl);
  return {
    months,
    latestMonth,
    formats: parseChaosListing(chaos, latestMonth)
  };
}
