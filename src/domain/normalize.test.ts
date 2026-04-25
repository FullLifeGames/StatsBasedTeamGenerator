import {describe, expect, it} from 'vitest';
import {normalizeChaos} from './normalize';

const rawChaos = {
  info: {'number of battles': 1289120, cutoff: 1825},
  data: {
    'Great Tusk': {
      usage: 30.5,
      'Raw count': 788209,
      'Viability Ceiling': [44287, 92, 81, 63],
      Abilities: {protosynthesis: 4174.05},
      Items: {rockyhelmet: 940.4, boosterenergy: 1161.6},
      Spreads: {'Jolly:0/252/4/0/0/252': 926.9},
      Moves: {rapidspin: 3630.1, stealthrock: 1672.2, headlongrush: 3562.0},
      'Tera Types': {Steel: 1133.5},
      Teammates: {Kingambit: 1584.0},
      'Checks and Counters': {
        'Iron Valiant': {n: 30.68, p: 0.814, d: 0.07}
      }
    },
    'Iron Valiant': {
      usage: 16.7,
      'Raw count': 356429,
      'Viability Ceiling': [1000, 88, 70, 50],
      Abilities: {quarkdrive: 1000},
      Items: {boosterenergy: 500},
      Spreads: {'Timid:0/0/0/252/4/252': 300},
      Moves: {moonblast: 800},
      'Tera Types': {Fairy: 300},
      Teammates: {},
      'Checks and Counters': {}
    }
  }
};

describe('normalizeChaos', () => {
  it('normalizes Pokemon data and preserves display names', () => {
    const dataset = normalizeChaos(rawChaos, {
      month: '2026-03',
      format: 'gen9ou',
      cutoff: 1825,
      url: 'https://www.smogon.com/stats/2026-03/chaos/gen9ou-1825.json'
    });

    expect(dataset.source.battles).toBe(1289120);
    expect(dataset.pokemonById.greattusk.name).toBe('Great Tusk');
    expect(dataset.pokemonById.greattusk.moves.rapidspin).toBeCloseTo(3630.1);
    expect(dataset.pokemonById.greattusk.checks).toEqual([
      {target: 'ironvaliant', samples: 30.68, probability: 0.814, deviation: 0.07}
    ]);
    expect(dataset.displayNames.ironvaliant).toBe('Iron Valiant');
  });
});
