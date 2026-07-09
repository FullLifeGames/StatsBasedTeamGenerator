import {describe, expect, it} from 'vitest';
import {makePokemon} from '../test/fixtures';
import {
  abilityBias,
  archetypeListings,
  archetypeProfile,
  archetypeRoleWeights,
  itemBias,
  memberArchetypeFit,
  setArchetypeScore,
  spreadBias,
  statAxes,
  statShortfall,
  statTargetScore
} from './archetype';
import {emptyRoles, inferFormatProfile} from './formatProfile';
import {detectRoles} from './roles';
import type {RoleScores, SetCandidate, TeamMember} from './types';

const profile = inferFormatProfile('gen9ou');

const blissey = makePokemon({id: 'blissey', name: 'Blissey', moves: {softboiled: 100, seismictoss: 90, toxic: 80}});
const skarmory = makePokemon({id: 'skarmory', name: 'Skarmory', moves: {roost: 100, spikes: 90, bodypress: 80}});
const dragapult = makePokemon({id: 'dragapult', name: 'Dragapult', moves: {dracometeor: 100, shadowball: 90, uturn: 80}});
const weavile = makePokemon({id: 'weavile', name: 'Weavile', moves: {knockoff: 100, iceshard: 90, swordsdance: 80}});

function member(stats: typeof blissey): TeamMember {
  return {stats, set: {...candidate(), roles: detectRoles(stats, profile)}, explanation: []};
}

function candidate(roles: Partial<RoleScores> = {}): SetCandidate {
  return {
    pokemonId: 'x',
    pokemonName: 'X',
    ability: '',
    item: '',
    moves: [],
    roles: {...emptyRoles, ...roles},
    confidence: 1,
    sourceWeights: {ability: 1, item: 1, teraType: 0, moves: 4, spread: 1}
  };
}

describe('statAxes', () => {
  it('separates a wall from a sweeper by base stats alone', () => {
    const wall = statAxes(blissey, profile);
    const sweeper = statAxes(dragapult, profile);

    expect(wall.bulk).toBeGreaterThan(sweeper.bulk);
    expect(sweeper.speed).toBeGreaterThan(wall.speed);
    expect(sweeper.offense).toBeGreaterThan(wall.offense);
  });

  it('falls back to average stats for a species the dex does not know', () => {
    const axes = statAxes(makePokemon({id: 'notapokemon', name: 'Not A Pokemon'}), profile);
    expect(axes.offense).toBeCloseTo(80 / 150, 3);
  });
});

describe('statShortfall', () => {
  it('charges nothing for exceeding a requirement', () => {
    // Dragapult is faster and stronger than hyper offense demands.
    expect(statShortfall(dragapult, profile, 'hyper-offense')).toBe(0);
  });

  it('charges a wall for failing hyper offense speed and power', () => {
    expect(statShortfall(blissey, profile, 'hyper-offense')).toBeGreaterThan(0.5);
  });

  it('charges a sweeper for failing stall bulk', () => {
    expect(statShortfall(dragapult, profile, 'stall')).toBeGreaterThan(0);
    expect(statShortfall(blissey, profile, 'stall')).toBe(0);
  });

  it('is zero for archetypes with no stat requirement', () => {
    expect(statShortfall(blissey, profile, 'balanced')).toBe(0);
    expect(statShortfall(blissey, profile, 'weather')).toBe(0);
  });
});

describe('archetypeRoleWeights', () => {
  it('reshapes role weights so the archetype changes what a good team is', () => {
    const stall = archetypeRoleWeights(profile, 'stall');
    const hyperOffense = archetypeRoleWeights(profile, 'hyper-offense');

    expect(stall.defensivePivot).toBeGreaterThan(profile.roleWeights.defensivePivot);
    expect(stall.setup).toBeLessThan(profile.roleWeights.setup);
    expect(hyperOffense.setup).toBeGreaterThan(profile.roleWeights.setup);
    expect(hyperOffense.defensivePivot).toBeLessThan(profile.roleWeights.defensivePivot);
  });

  it('leaves duplicate-role penalties alone, since they are a format rule', () => {
    expect(archetypeRoleWeights(profile, 'stall').duplicateHazardPenalty)
      .toBe(profile.roleWeights.duplicateHazardPenalty);
  });

  it('leaves balanced untouched', () => {
    expect(archetypeProfile(profile, 'balanced').roleWeights).toEqual(profile.roleWeights);
  });
});

describe('statTargetScore', () => {
  it('goes negative for a team built against its archetype', () => {
    const walls = [member(blissey), member(skarmory)];
    expect(statTargetScore(walls, profile, 'hyper-offense')).toBeLessThan(0);
    expect(statTargetScore(walls, profile, 'stall')).toBeGreaterThan(0);
  });

  it('rewards a team built for its archetype', () => {
    const sweepers = [member(dragapult), member(weavile)];
    expect(statTargetScore(sweepers, profile, 'hyper-offense')).toBeGreaterThan(0);
    expect(statTargetScore(sweepers, profile, 'stall')).toBeLessThan(statTargetScore(sweepers, profile, 'offense'));
  });

  it('keeps one bad member visible instead of averaging it away', () => {
    const clean = [member(dragapult), member(weavile)];
    const withWall = [member(dragapult), member(weavile), member(blissey)];

    expect(statTargetScore(withWall, profile, 'hyper-offense'))
      .toBeLessThan(statTargetScore(clean, profile, 'hyper-offense'));
  });

  it('is neutral for balanced', () => {
    expect(statTargetScore([member(blissey)], profile, 'balanced')).toBe(0);
  });
});

describe('setArchetypeScore', () => {
  it('prefers the wall set for stall and the sweeper set for hyper offense', () => {
    const wallSet = candidate({defensivePivot: 1, support: 1});
    const sweeperSet = candidate({setup: 1, cleaner: 1});

    expect(setArchetypeScore(wallSet, 'stall')).toBeGreaterThan(setArchetypeScore(sweeperSet, 'stall'));
    expect(setArchetypeScore(sweeperSet, 'hyper-offense')).toBeGreaterThan(setArchetypeScore(wallSet, 'hyper-offense'));
  });

  it('is neutral for balanced, which keeps the stats ordering', () => {
    expect(setArchetypeScore(candidate({setup: 1, defensivePivot: 1}), 'balanced')).toBe(0);
  });
});

describe('memberArchetypeFit', () => {
  it('ranks a sweeper above a wall for hyper offense, and the reverse for stall', () => {
    const fitSweeper = memberArchetypeFit(dragapult, profile, 'hyper-offense', detectRoles(dragapult, profile));
    const fitWall = memberArchetypeFit(blissey, profile, 'hyper-offense', detectRoles(blissey, profile));
    expect(fitSweeper).toBeGreaterThan(fitWall);

    const stallSweeper = memberArchetypeFit(dragapult, profile, 'stall', detectRoles(dragapult, profile));
    const stallWall = memberArchetypeFit(blissey, profile, 'stall', detectRoles(blissey, profile));
    expect(stallWall).toBeGreaterThan(stallSweeper);
  });
});

describe('itemBias and abilityBias', () => {
  it('points offensive items at offensive archetypes and defensive items at stall', () => {
    expect(itemBias('Life Orb', 'hyper-offense')).toBeGreaterThan(0);
    expect(itemBias('Life Orb', 'stall')).toBeLessThan(0);
    expect(itemBias('Leftovers', 'stall')).toBeGreaterThan(0);
    expect(itemBias('Leftovers', 'hyper-offense')).toBeLessThan(0);
  });

  it('reads display names as well as ids', () => {
    expect(itemBias('Heavy-Duty Boots', 'stall')).toBe(itemBias('heavydutyboots', 'stall'));
  });

  it('is neutral for unclassified items, abilities, and for balanced', () => {
    expect(itemBias('Sitrus Berry', 'stall')).toBe(0);
    expect(itemBias('Life Orb', 'balanced')).toBe(0);
    expect(abilityBias('Pressure', 'stall')).toBe(0);
  });

  it('prefers a lesser ability that suits the plan', () => {
    expect(abilityBias('Regenerator', 'stall')).toBeGreaterThan(0);
    expect(abilityBias('Sheer Force', 'stall')).toBeLessThan(0);
    expect(abilityBias('Sheer Force', 'hyper-offense')).toBeGreaterThan(0);
  });
});

describe('spreadBias', () => {
  it('rewards offensive investment for offense and defensive investment for stall', () => {
    const offensive = [0, 252, 4, 0, 0, 252];
    const defensive = [252, 0, 128, 0, 128, 0];

    expect(spreadBias(offensive, 'hyper-offense')).toBeGreaterThan(0);
    expect(spreadBias(offensive, 'stall')).toBeLessThan(0);
    expect(spreadBias(defensive, 'stall')).toBeGreaterThan(0);
  });

  it('ignores a malformed or empty spread', () => {
    expect(spreadBias([], 'stall')).toBe(0);
    expect(spreadBias([0, 0, 0, 0, 0, 0], 'stall')).toBe(0);
    expect(spreadBias([252, 252], 'stall')).toBe(0);
  });
});

describe('archetypeListings', () => {
  it('offers hyper offense and describes every archetype', () => {
    expect(archetypeListings.map(listing => listing.value)).toContain('hyper-offense');
    expect(archetypeListings.every(listing => listing.label && listing.description)).toBe(true);
  });
});
