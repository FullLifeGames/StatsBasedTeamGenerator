import {describe, expect, it} from 'vitest';
import {makePokemon} from '../test/fixtures';
import {inferFormatProfile} from './formatProfile';
import {formatSet, formatTeam} from './importable';
import {buildSetCandidates} from './sets';

describe('formatSet', () => {
  it('formats a set as Pokemon Showdown import text', () => {
    const [set] = buildSetCandidates(makePokemon({
      id: 'greattusk',
      name: 'Great Tusk',
      abilities: {protosynthesis: 100},
      items: {boosterenergy: 60, rockyhelmet: 40},
      spreads: {'Jolly:0/252/4/0/0/252': 80},
      moves: {rapidspin: 90, headlongrush: 90, stealthrock: 50, knockoff: 35, icespinner: 30},
      teraTypes: {steel: 40}
    }), inferFormatProfile('gen9ou'));

    const text = formatSet(set);

    expect(text).toContain('Great Tusk @ Booster Energy');
    expect(text).toContain('Ability: Protosynthesis');
    expect(text).toContain('Tera Type: Steel');
    expect(text).toContain('- Rapid Spin');
  });

  it('omits old-generation sentinel ability, item, EV, nature, and tera fields', () => {
    const [set] = buildSetCandidates(makePokemon({
      id: 'tauros',
      name: 'Tauros',
      abilities: {noability: 100},
      items: {nothing: 100},
      spreads: {'Serious:252/252/252/252/252/252': 100},
      moves: {bodyslam: 100, hyperbeam: 95, earthquake: 90, blizzard: 80},
      teraTypes: {}
    }), inferFormatProfile('gen1ou'));

    const text = formatSet(set);

    expect(text).toContain('Tauros\n');
    expect(text).not.toContain('@ Nothing');
    expect(text).not.toContain('Ability: No Ability');
    expect(text).not.toContain('EVs:');
    expect(text).not.toContain('Nature');
    expect(text).not.toContain('Tera Type:');
    expect(text).toContain('- Body Slam');
  });
});

describe('formatTeam', () => {
  it('formats an object with members as Pokemon Showdown import text', () => {
    const [set] = buildSetCandidates(makePokemon({
      id: 'greattusk',
      name: 'Great Tusk',
      abilities: {protosynthesis: 100},
      items: {boosterenergy: 60, rockyhelmet: 40},
      spreads: {'Jolly:0/252/4/0/0/252': 80},
      moves: {rapidspin: 90, headlongrush: 90, stealthrock: 50, knockoff: 35, icespinner: 30},
      teraTypes: {steel: 40}
    }), inferFormatProfile('gen9ou'));

    const text = formatTeam({members: [set]});

    expect(text).toContain('Great Tusk @ Booster Energy');
    expect(text).toContain('- Rapid Spin');
  });
});
