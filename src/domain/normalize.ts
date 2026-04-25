import {toId} from './id';
import type {CounterEdge, PokemonStats, SourceMeta, StatsDataset, WeightedTable} from './types';

type RawPokemon = Record<string, unknown>;

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function finiteTable(value: unknown, normalizeKey: (key: string) => string): WeightedTable {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, weight]) => typeof weight === 'number' && Number.isFinite(weight))
      .map(([key, weight]) => [normalizeKey(key), weight as number])
  );
}

function weightedTable(value: unknown): WeightedTable {
  return finiteTable(value, toId);
}

function usageValue(value: unknown): number {
  const usage = numberValue(value);
  return usage > 0 && usage <= 1 ? usage * 100 : usage;
}

function normalizeChecks(value: unknown): CounterEdge[] {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, {n?: number; p?: number; d?: number}>)
    .map(([target, edge]) => ({
      target: toId(target),
      samples: numberValue(edge.n),
      probability: numberValue(edge.p),
      deviation: numberValue(edge.d)
    }))
    .filter(edge => edge.samples > 0);
}

function viability(value: unknown): number {
  if (Array.isArray(value)) return numberValue(value[1]);
  return numberValue(value);
}

export function normalizeChaos(raw: unknown, source: SourceMeta): StatsDataset {
  const root = raw as {info?: Record<string, unknown>; data?: Record<string, RawPokemon>};
  const displayNames: Record<string, string> = {};
  const pokemon: PokemonStats[] = Object.entries(root.data ?? {}).map(([name, entry]) => {
    const id = toId(name);
    displayNames[id] = name;
    return {
      id,
      name,
      usage: usageValue(entry.usage),
      rawCount: numberValue(entry['Raw count']),
      viability: viability(entry['Viability Ceiling']),
      abilities: weightedTable(entry.Abilities),
      items: weightedTable(entry.Items),
      spreads: finiteTable(entry.Spreads, key => key),
      moves: weightedTable(entry.Moves),
      teraTypes: weightedTable(entry['Tera Types']),
      teammates: weightedTable(entry.Teammates),
      checks: normalizeChecks(entry['Checks and Counters'])
    };
  });

  pokemon.sort((a, b) => b.usage - a.usage);
  return {
    source: {
      ...source,
      battles: numberValue(root.info?.['number of battles'], source.battles)
    },
    pokemon,
    pokemonById: Object.fromEntries(pokemon.map(mon => [mon.id, mon])),
    displayNames
  };
}
