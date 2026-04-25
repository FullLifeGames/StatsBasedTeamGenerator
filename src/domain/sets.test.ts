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
      moves: {rapidspin: 95, headlongrush: 90, knockoff: 80, icespinner: 75, stealthrock: 40},
      teraTypes: {steel: 40}
    });

    const [candidate] = buildSetCandidates(stats, profile, {
      existingRoles: {hazardSetter: 1}
    });

    expect(candidate.moves).not.toContain('Stealth Rock');
    expect(candidate.roles.hazardSetter).toBe(0);
    expect(candidate.roles.hazardRemoval).toBeGreaterThan(0);
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
