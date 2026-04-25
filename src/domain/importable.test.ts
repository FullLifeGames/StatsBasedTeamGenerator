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
