import type {StatsDataset, StatsIndex} from '../domain/types';

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

export async function fetchStatsDataset(month: string, format: string, cutoff: number): Promise<StatsDataset> {
  const path = [
    '/api/stats',
    encodeURIComponent(month),
    encodeURIComponent(format),
    encodeURIComponent(String(cutoff))
  ].join('/');

  return readJson<StatsDataset>(await fetch(path));
}
