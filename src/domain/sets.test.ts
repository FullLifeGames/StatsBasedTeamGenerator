import {describe, expect, it} from 'vitest';
import {makePokemon} from '../test/fixtures';
import {inferFormatProfile} from './formatProfile';
import {buildSetCandidates, scoreSetForTeamContext} from './sets';

const greatTuskStats = makePokemon({
  id: 'greattusk',
  name: 'Great Tusk',
  abilities: {protosynthesis: 100},
  items: {boosterenergy: 60, rockyhelmet: 40},
  spreads: {'Jolly:0/252/4/0/0/252': 80},
  moves: {rapidspin: 90, headlongrush: 90, stealthrock: 50, knockoff: 35, icespinner: 30},
  teraTypes: {steel: 40}
});

describe('buildSetCandidates', () => {
  it('builds likely sets from weighted Great Tusk stats', () => {
    const [set] = buildSetCandidates(greatTuskStats, inferFormatProfile('gen9ou'));

    expect(set.ability).toBe('Protosynthesis');
    expect(set.item).toBe('Booster Energy');
    expect(set.moves).toHaveLength(4);
    expect(set.moves).toContain('Rapid Spin');
    expect(set.evs).toBe('0 HP / 252 Atk / 4 Def / 0 SpA / 0 SpD / 252 Spe');
    expect(set.nature).toBe('Jolly');
  });

  it('uses selected moves, not the whole move table, for set role attribution', () => {
    const profile = inferFormatProfile('gen9ou');
    const stats = makePokemon({
      id: 'greattusk',
      name: 'Great Tusk',
      abilities: {protosynthesis: 100},
      items: {boosterenergy: 70},
      spreads: {'Jolly:0/252/4/0/0/252': 80},
      moves: {stealthrock: 5000, rapidspin: 4800, headlongrush: 4700, knockoff: 4600, icespinner: 4500},
      teraTypes: {steel: 40}
    });

    const [candidate] = buildSetCandidates(stats, profile, {
      existingRoles: {hazardSetter: 1}
    });

    expect(candidate.moves).not.toContain('Stealth Rock');
    expect(candidate.roles.hazardSetter).toBe(0);
    expect(candidate.roles.hazardRemoval).toBeGreaterThan(0);
  });

  it('bounds confidence when source weights are large raw counts', () => {
    const [candidate] = buildSetCandidates(makePokemon({
      id: 'kingambit',
      name: 'Kingambit',
      abilities: {supremeoverlord: 12000, defiant: 3000},
      items: {blackglasses: 9000, leftovers: 1000},
      spreads: {'Adamant:0/252/4/0/0/252': 8500, 'Jolly:0/252/4/0/0/252': 1500},
      moves: {kowtowcleave: 11000, suckerpunch: 10000, ironhead: 9000, swordsdance: 8000, lowkick: 7000},
      teraTypes: {dark: 9000, flying: 1000}
    }), inferFormatProfile('gen9ou'));

    expect(candidate.confidence).toBeGreaterThan(0);
    expect(candidate.confidence).toBeLessThanOrEqual(1);
  });

  it('uses dex names for compact ability and item ids', () => {
    const [kingambit] = buildSetCandidates(makePokemon({
      id: 'kingambit',
      name: 'Kingambit',
      abilities: {supremeoverlord: 100},
      items: {blackglasses: 100},
      spreads: {'Adamant:0/252/4/0/0/252': 100},
      moves: {kowtowcleave: 100, suckerpunch: 90, ironhead: 80, swordsdance: 70},
      teraTypes: {dark: 100}
    }), inferFormatProfile('gen9ou'));
    const [tinglu] = buildSetCandidates(makePokemon({
      id: 'tinglu',
      name: 'Ting-Lu',
      abilities: {vesselofruin: 100},
      items: {leftovers: 100},
      spreads: {'Careful:252/0/4/0/252/0': 100},
      moves: {stealthrock: 100, spikes: 90, ruination: 80, whirlwind: 70},
      teraTypes: {poison: 100}
    }), inferFormatProfile('gen9ou'));

    expect(kingambit.item).toBe('Black Glasses');
    expect(kingambit.ability).toBe('Supreme Overlord');
    expect(tinglu.ability).toBe('Vessel of Ruin');
  });
});

describe('scoreSetForTeamContext', () => {
  it('penalizes another singles rocker when hazards are already covered', () => {
    const profile = inferFormatProfile('gen9ou');
    const [rocker] = buildSetCandidates(greatTuskStats, profile);

    const firstRockerScore = scoreSetForTeamContext(rocker, [], profile);
    const duplicateRockerScore = scoreSetForTeamContext(rocker, [{
      pokemonId: 'tinglu',
      pokemonName: 'Ting-Lu',
      ability: 'Vessel of Ruin',
      item: 'Leftovers',
      moves: ['Stealth Rock', 'Spikes', 'Ruination', 'Whirlwind'],
      roles: {...rocker.roles, hazardSetter: 1, hazardRemoval: 0},
      confidence: 1,
      sourceWeights: {ability: 100, item: 80, teraType: 0, moves: 300, spread: 80}
    }], profile);

    expect(firstRockerScore).toBeGreaterThan(0);
    expect(duplicateRockerScore).toBeLessThan(firstRockerScore);
  });
});
