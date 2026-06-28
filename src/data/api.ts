import type {AnalysisSetTemplate, FormatListing, StatsDataset, StatsIndex, TeamValidation} from '../domain/types';

const statsDatasetRequests = new Map<string, Promise<StatsDataset>>();
const analysisSetRequests = new Map<string, Promise<Record<string, AnalysisSetTemplate[]>>>();

function isMessageBody(body: unknown): body is {message: string} {
  return typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string';
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json() as unknown;

  if (!response.ok) {
    if (isMessageBody(body)) {
      throw new Error(body.message);
    }

    throw new Error(`API request failed with status ${response.status}`);
  }

  return body as T;
}

export async function fetchStatsIndex(): Promise<StatsIndex> {
  return readJson<StatsIndex>(await fetch('/api/stats/index'));
}

export async function fetchMonthFormats(month: string): Promise<FormatListing[]> {
  return readJson<FormatListing[]>(await fetch(`/api/stats/index/${encodeURIComponent(month)}`));
}

export async function fetchStatsDataset(month: string, format: string, cutoff: number): Promise<StatsDataset> {
  const path = [
    '/api/stats',
    encodeURIComponent(month),
    encodeURIComponent(format),
    encodeURIComponent(String(cutoff))
  ].join('/');

  const cached = statsDatasetRequests.get(path);
  if (cached) return cached;

  const request = fetch(path).then(response => readJson<StatsDataset>(response)).catch(error => {
    statsDatasetRequests.delete(path);
    throw error;
  });
  statsDatasetRequests.set(path, request);
  return request;
}

export function prefetchStatsDataset(month: string, format: string, cutoff: number): void {
  void fetchStatsDataset(month, format, cutoff).catch(() => {
    // Prefetch is opportunistic; Generate will surface a real error if the user needs this dataset.
  });
}

export async function fetchAnalysisSetTemplates(
  format: string,
  pokemon: string[]
): Promise<Record<string, AnalysisSetTemplate[]>> {
  const path = `/api/sets/${encodeURIComponent(format)}`;
  const cacheKey = `${path}:${pokemon.map(name => name.trim()).filter(Boolean).sort().join('|')}`;
  const cached = analysisSetRequests.get(cacheKey);
  if (cached) return cached;

  const request = fetch(path, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({pokemon})
  }).then(response => readJson<Record<string, AnalysisSetTemplate[]>>(response)).catch(error => {
    analysisSetRequests.delete(cacheKey);
    throw error;
  });
  analysisSetRequests.set(cacheKey, request);
  return request;
}

export async function fetchTeamValidation(format: string, importable: string): Promise<TeamValidation> {
  return readJson<TeamValidation>(await fetch(`/api/validate/${encodeURIComponent(format)}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({importable})
  }));
}

export function clearApiCaches(): void {
  statsDatasetRequests.clear();
  analysisSetRequests.clear();
}
