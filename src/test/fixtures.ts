import type {PokemonStats, StatsDataset} from '../domain/types';

export function makePokemon(overrides: Partial<PokemonStats> & Pick<PokemonStats, 'id' | 'name'>): PokemonStats {
  return {
    usage: 10,
    rawCount: 1000,
    viability: 80,
    abilities: {},
    items: {},
    spreads: {},
    moves: {},
    teraTypes: {},
    teammates: {},
    checks: [],
    ...overrides
  };
}

export function makeDataset(pokemon: PokemonStats[]): StatsDataset {
  const pokemonById = Object.fromEntries(pokemon.map(mon => [mon.id, mon]));
  const displayNames = Object.fromEntries(pokemon.map(mon => [mon.id, mon.name]));
  return {
    source: {
      month: '2026-03',
      format: 'gen9ou',
      cutoff: 1825,
      url: 'https://www.smogon.com/stats/2026-03/chaos/gen9ou-1825.json',
      battles: 100000
    },
    pokemon,
    pokemonById,
    displayNames
  };
}
