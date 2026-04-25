import {toId} from './id';
import type {CounterEdge, PokemonStats, SourceMeta, StatsDataset, WeightedTable} from './types';

type RawPokemon = Record<string, unknown>;

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function weightedTable(value: unknown): WeightedTable {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, weight]) => typeof weight === 'number' && Number.isFinite(weight))
      .map(([key, weight]) => [toId(key), weight as number])
  );
}

function teraTable(value: unknown): WeightedTable {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, weight]) => typeof weight === 'number' && Number.isFinite(weight))
      .map(([key, weight]) => [key, weight as number])
  );
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
      usage: numberValue(entry.usage),
      rawCount: numberValue(entry['Raw count']),
      viability: viability(entry['Viability Ceiling']),
      abilities: weightedTable(entry.Abilities),
      items: weightedTable(entry.Items),
      spreads:
        entry.Spreads && typeof entry.Spreads === 'object'
          ? Object.fromEntries(Object.entries(entry.Spreads as Record<string, number>))
          : {},
      moves: weightedTable(entry.Moves),
      teraTypes: teraTable(entry['Tera Types']),
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
