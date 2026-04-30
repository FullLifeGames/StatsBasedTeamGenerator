import type {AnalysisSetTemplate, FormatListing, StatsDataset, StatsIndex, TeamValidation} from '../domain/types';

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

  return readJson<StatsDataset>(await fetch(path));
}

export async function fetchAnalysisSetTemplates(
  format: string,
  pokemon: string[]
): Promise<Record<string, AnalysisSetTemplate[]>> {
  return readJson<Record<string, AnalysisSetTemplate[]>>(await fetch(`/api/sets/${encodeURIComponent(format)}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({pokemon})
  }));
}

export async function fetchTeamValidation(format: string, importable: string): Promise<TeamValidation> {
  return readJson<TeamValidation>(await fetch(`/api/validate/${encodeURIComponent(format)}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({importable})
  }));
}
