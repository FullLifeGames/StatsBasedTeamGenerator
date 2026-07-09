import {describe, expect, it} from 'vitest';
import {makePokemon} from '../test/fixtures';
import {emptyRoles} from './formatProfile';
import type {TeamMember} from './types';
import {
  abusedConditions,
  abuserCount,
  committedCondition,
  fieldConflictPenalty,
  fieldConflictWarnings,
  memberAbusedConditions,
  memberSetConditions,
  settableConditions,
  setterCount
} from './weather';

function member(name: string, set: {ability?: string; item?: string; moves?: string[]}, usage = 10): TeamMember {
  return {
    stats: makePokemon({id: name.toLowerCase(), name, usage}),
    set: {
      pokemonId: name.toLowerCase(),
      pokemonName: name,
      ability: set.ability ?? '',
      item: set.item ?? '',
      moves: set.moves ?? [],
      roles: {...emptyRoles},
      confidence: 1,
      sourceWeights: {ability: 1, item: 1, teraType: 0, moves: 4, spread: 1}
    },
    explanation: []
  };
}

const pelipper = member('Pelipper', {ability: 'Drizzle', item: 'Damp Rock'}, 20);
const barraskewda = member('Barraskewda', {ability: 'Swift Swim', moves: ['Liquidation', 'Close Combat']}, 15);
const torkoal = member('Torkoal', {ability: 'Drought', item: 'Heat Rock'}, 18);
const venusaur = member('Venusaur', {ability: 'Chlorophyll', moves: ['Growth', 'Sludge Bomb']}, 12);
const greatTusk = member('Great Tusk', {ability: 'Protosynthesis', item: 'Booster Energy'}, 30);
const kingambit = member('Kingambit', {ability: 'Supreme Overlord', item: 'Booster Energy'}, 30);

describe('settableConditions', () => {
  it('reads the weather a Pokemon sets from its abilities and moves', () => {
    const drizzle = makePokemon({id: 'pelipper', name: 'Pelipper', abilities: {drizzle: 90, keeneye: 10}});
    expect(settableConditions(drizzle).get('rain')).toBeCloseTo(0.9, 2);

    const raindance = makePokemon({id: 'ludicolo', name: 'Ludicolo', moves: {raindance: 100, surf: 100, giga: 100, icebeam: 100}});
    expect(settableConditions(raindance).has('rain')).toBe(true);
  });

  it('does not treat an abuser as a setter', () => {
    const swiftSwim = makePokemon({id: 'barraskewda', name: 'Barraskewda', abilities: {swiftswim: 100}});
    expect(settableConditions(swiftSwim).size).toBe(0);
  });
});

describe('abusedConditions', () => {
  it('reads the weather a Pokemon wants from abilities, items, and moves', () => {
    const swiftSwim = makePokemon({id: 'barraskewda', name: 'Barraskewda', abilities: {swiftswim: 100}});
    expect(abusedConditions(swiftSwim).get('rain')).toBe(1);

    const heatRock = makePokemon({id: 'torkoal', name: 'Torkoal', items: {heatrock: 100}});
    expect(abusedConditions(heatRock).get('sun')).toBe(1);
  });
});

describe('committedCondition', () => {
  it('picks the condition that the team actually supports', () => {
    expect(committedCondition([pelipper, barraskewda])).toBe('rain');
  });

  it('prefers the condition with abusers over a lone second setter', () => {
    expect(committedCondition([pelipper, barraskewda, torkoal])).toBe('rain');
  });

  it('returns null without a setter', () => {
    expect(committedCondition([barraskewda, greatTusk])).toBeNull();
  });
});

describe('memberSetConditions and memberAbusedConditions', () => {
  it('uses the selected set rather than every option in the stats file', () => {
    expect([...memberSetConditions(pelipper)]).toEqual(['rain']);
    expect([...memberAbusedConditions(barraskewda)]).toEqual(['rain']);
  });

  it('treats Booster Energy as condition-less', () => {
    expect(memberAbusedConditions(kingambit).size).toBe(0);
  });

  it('still reads Protosynthesis as a sun ability', () => {
    expect([...memberAbusedConditions(greatTusk)]).toEqual(['sun']);
  });
});

describe('setterCount and abuserCount', () => {
  it('counts a setter that also abuses its own weather only as a setter', () => {
    const team = [pelipper, barraskewda];
    expect(setterCount(team, 'rain')).toBe(1);
    expect(abuserCount(team, 'rain')).toBe(1);
  });
});

describe('fieldConflictPenalty', () => {
  it('is free for a single committed weather', () => {
    expect(fieldConflictPenalty([pelipper, barraskewda])).toBe(0);
    expect(fieldConflictWarnings([pelipper, barraskewda])).toEqual([]);
  });

  it('penalizes stacking a second weather', () => {
    expect(fieldConflictPenalty([pelipper, barraskewda, torkoal, venusaur])).toBe(2.5);
    expect(fieldConflictWarnings([pelipper, torkoal])).toEqual([
      'Conflicting weather setters: Rain, Sun'
    ]);
  });

  it('penalizes conflicting terrains separately from weather', () => {
    const tapuKoko = member('Tapu Koko', {ability: 'Electric Surge'});
    const tapuLele = member('Tapu Lele', {ability: 'Psychic Surge'});
    expect(fieldConflictPenalty([pelipper, tapuKoko, tapuLele])).toBe(2);
  });
});
