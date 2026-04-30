import {Generations, type ID} from '@pkmn/data';
import {Dex} from '@pkmn/dex';
import {Smogon} from '@pkmn/smogon';
import {toId} from '../../src/domain/id';
import type {AnalysisSetTemplate} from '../../src/domain/types';
import {readThroughCache} from './cache';

interface JsonResponse {
  json(): Promise<unknown>;
}

const gens = new Generations(Dex);

function cachedFetch(cache: typeof readThroughCache): (url: string) => Promise<JsonResponse> {
  return async (url: string) => ({
    json: async () => JSON.parse(await cache(`data-pkmn:${url}`, 24 * 60 * 60_000, async () => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Unable to fetch ${url}: ${response.status}`);
      return response.text();
    })) as unknown
  });
}

function evsFromSet(evs: unknown): AnalysisSetTemplate['evs'] {
  if (!evs || typeof evs !== 'object') return undefined;
  const source = evs as Record<string, unknown>;
  const result: AnalysisSetTemplate['evs'] = {};

  for (const [key, stat] of [
    ['hp', 'hp'],
    ['atk', 'atk'],
    ['def', 'def'],
    ['spa', 'spa'],
    ['spd', 'spd'],
    ['spe', 'spe']
  ] as const) {
    const value = source[key] ?? source[stat.toUpperCase()];
    if (typeof value === 'number' && value > 0) result[stat] = value;
  }

  return Object.keys(result).length ? result : undefined;
}

function normalizeSet(raw: Record<string, unknown>): AnalysisSetTemplate | null {
  const moves = Array.isArray(raw.moves)
    ? raw.moves.filter((move): move is string => typeof move === 'string').slice(0, 4)
    : [];
  if (!moves.length) return null;

  return {
    name: typeof raw.name === 'string' ? raw.name : undefined,
    ability: typeof raw.ability === 'string' ? raw.ability : undefined,
    item: typeof raw.item === 'string' ? raw.item : undefined,
    teraType: typeof raw.teraType === 'string' ? raw.teraType : undefined,
    nature: typeof raw.nature === 'string' ? raw.nature : undefined,
    evs: evsFromSet(raw.evs),
    moves
  };
}

export async function fetchAnalysisSetTemplates(
  format: string,
  pokemon: string[],
  cache: typeof readThroughCache = readThroughCache
): Promise<Record<string, AnalysisSetTemplate[]>> {
  const genNumber = Number(format.match(/^gen(\d+)/)?.[1] ?? 9);
  const generation = gens.get(genNumber);
  const smogon = new Smogon(cachedFetch(cache), true);
  const result: Record<string, AnalysisSetTemplate[]> = {};

  for (const name of pokemon) {
    const sets = await smogon.sets(generation, name, format as ID);
    const normalized = sets
      .map(set => normalizeSet(set as Record<string, unknown>))
      .filter((set): set is AnalysisSetTemplate => Boolean(set));
    result[toId(name)] = normalized;
  }

  return result;
}
