import {describe, expect, it} from 'vitest';
import {makeDataset, makePokemon} from '../test/fixtures';
import {inferFormatProfile} from './formatProfile';
import {buildSetCandidates} from './sets';
import type {PokemonStats, TeamMember} from './types';
import {scoreTeam, synergyInsights, threatCoverage} from './scoring';

function member(stats: PokemonStats, format = 'gen9ou'): TeamMember {
  const profile = inferFormatProfile(format);
  return {
    stats,
    set: buildSetCandidates(stats, profile)[0],
    explanation: []
  };
}

describe('scoreTeam', () => {
  it('penalizes duplicate singles hazard setters', () => {
    const rockerA = makePokemon({id: 'tinglu', name: 'Ting-Lu', moves: {stealthrock: 100}, teammates: {}});
    const rockerB = makePokemon({id: 'glimmora', name: 'Glimmora', moves: {stealthrock: 100, spikes: 100}, teammates: {}});
    const dataset = makeDataset([rockerA, rockerB]);
    const score = scoreTeam([member(rockerA), member(rockerB)], dataset, inferFormatProfile('gen9ou'));

    expect(score.duplicateRoles).toBeLessThan(0);
  });

  it('rewards doubles speed control more than hazards', () => {
    const tailwind = makePokemon({id: 'tornadus', name: 'Tornadus', moves: {tailwind: 100, protect: 50}});
    const rocker = makePokemon({id: 'glimmora', name: 'Glimmora', moves: {stealthrock: 100}});
    const dataset = makeDataset([tailwind, rocker]);
    const speedScore = scoreTeam([member(tailwind, 'gen9doublesou')], dataset, inferFormatProfile('gen9doublesou'));
    const hazardScore = scoreTeam([member(rocker, 'gen9doublesou')], dataset, inferFormatProfile('gen9doublesou'));

    expect(speedScore.roles).toBeGreaterThan(hazardScore.roles);
  });

  it('scores set-to-team fit from selected set roles instead of whole Pokemon roles', () => {
    const hazardOnly = makePokemon({id: 'tinglu', name: 'Ting-Lu', moves: {stealthrock: 100}});
    const mixed = makePokemon({
      id: 'greattusk',
      name: 'Great Tusk',
      moves: {stealthrock: 5000, rapidspin: 4800, headlongrush: 4700, knockoff: 4600, icespinner: 4500}
    });
    const profile = inferFormatProfile('gen9ou');
    const first = member(hazardOnly);
    const duplicateSet = buildSetCandidates(mixed, profile)[0];
    const selectedRemovalSet = buildSetCandidates(mixed, profile, {existingRoles: {hazardSetter: 1}})[0];
    const dataset = makeDataset([hazardOnly, mixed]);

    const duplicateFit = scoreTeam([first, {...member(mixed), set: duplicateSet}], dataset, profile).setToTeamFit;
    const selectedFit = scoreTeam([first, {...member(mixed), set: selectedRemovalSet}], dataset, profile).setToTeamFit;

    expect(selectedRemovalSet.roles.hazardSetter).toBe(0);
    expect(selectedFit).toBeGreaterThan(duplicateFit);
  });

  it('normalizes teammate synergy so common raw weights do not dominate alone', () => {
    const commonA = makePokemon({id: 'common-a', name: 'Common A', usage: 80, teammates: {'common-b': 4000}});
    const commonB = makePokemon({id: 'common-b', name: 'Common B', usage: 80, teammates: {'common-a': 4000}});
    const nicheA = makePokemon({id: 'niche-a', name: 'Niche A', usage: 5, teammates: {'niche-b': 700}});
    const nicheB = makePokemon({id: 'niche-b', name: 'Niche B', usage: 5, teammates: {'niche-a': 700}});
    const dataset = makeDataset([commonA, commonB, nicheA, nicheB]);
    const profile = inferFormatProfile('gen9ou');

    const commonScore = scoreTeam([member(commonA), member(commonB)], dataset, profile).synergy;
    const nicheScore = scoreTeam([member(nicheA), member(nicheB)], dataset, profile).synergy;

    expect(commonScore).toBeLessThan(nicheScore);
  });

  it('rewards teams that match the selected weather archetype', () => {
    const setter = makePokemon({
      id: 'pelipper',
      name: 'Pelipper',
      abilities: {drizzle: 100},
      moves: {hurricane: 100, uturn: 80, roost: 70}
    });
    const abuser = makePokemon({
      id: 'barraskewda',
      name: 'Barraskewda',
      abilities: {swiftswim: 100},
      moves: {liquidation: 100, closecombat: 90, flipturn: 80}
    });
    const dataset = makeDataset([setter, abuser]);
    const profile = inferFormatProfile('gen9ou');
    const members = [member(setter), member(abuser)];

    const balanced = scoreTeam(members, dataset, profile, 'balanced');
    const weather = scoreTeam(members, dataset, profile, 'weather');

    expect(weather.archetype).toBeGreaterThan(0);
    expect(weather.total).toBeGreaterThan(balanced.total);
  });

  it('warns and penalizes terrain seeds without matching terrain support', () => {
    const hawlucha = makePokemon({
      id: 'hawlucha',
      name: 'Hawlucha',
      items: {electricseed: 100},
      moves: {closecombat: 100, acrobatics: 95, swordsdance: 80, roost: 60}
    });
    const pincurchin = makePokemon({
      id: 'pincurchin',
      name: 'Pincurchin',
      abilities: {electricsurge: 100},
      moves: {thunderbolt: 100, spikes: 80, recover: 70, surf: 60}
    });
    const dataset = makeDataset([hawlucha, pincurchin]);
    const profile = inferFormatProfile('gen9ou');
    const unsupported = scoreTeam([member(hawlucha)], dataset, profile);
    const supported = scoreTeam([member(hawlucha), member(pincurchin)], dataset, profile);

    expect(unsupported.warnings).toContain('Hawlucha has Electric Seed without Electric Terrain support');
    expect(supported.warnings).not.toContain('Hawlucha has Electric Seed without Electric Terrain support');
    expect(unsupported.setToTeamFit).toBeLessThan(supported.setToTeamFit);
  });

  it('warns and penalizes teams with multiple Mega Stones', () => {
    const charizard = makePokemon({
      id: 'charizard',
      name: 'Charizard',
      items: {charizarditex: 100},
      moves: {flamethrower: 100, airslash: 90, roost: 80, dragonclaw: 70}
    });
    const scizor = makePokemon({
      id: 'scizor',
      name: 'Scizor',
      items: {scizorite: 100},
      moves: {bulletpunch: 100, uturn: 90, swordsdance: 80, roost: 70}
    });
    const dataset = makeDataset([charizard, scizor]);
    const profile = inferFormatProfile('gen7ou');
    const charizardMember = member(charizard, 'gen7ou');
    const scizorMegaMember = member(scizor, 'gen7ou');
    const scizorNonMegaMember = {
      ...scizorMegaMember,
      set: {
        ...scizorMegaMember.set,
        item: 'Leftovers',
        itemId: 'leftovers'
      }
    };

    const multipleMega = scoreTeam([charizardMember, scizorMegaMember], dataset, profile);
    const singleMega = scoreTeam([charizardMember, scizorNonMegaMember], dataset, profile);

    expect(multipleMega.warnings).toContain('Multiple Mega Stones: Charizard (Charizardite X), Scizor (Scizorite)');
    expect(singleMega.warnings).not.toContain('Multiple Mega Stones: Charizard (Charizardite X), Scizor (Scizorite)');
    expect(multipleMega.setToTeamFit).toBeLessThan(singleMega.setToTeamFit);
  });
});

describe('threatCoverage', () => {
  it('reports covered threats from checks and counters', () => {
    const greatTusk = makePokemon({id: 'greattusk', name: 'Great Tusk', usage: 30, checks: [{target: 'kingambit', samples: 50, probability: 0.7, deviation: 0.05}]});
    const kingambit = makePokemon({id: 'kingambit', name: 'Kingambit', usage: 28});
    const dataset = makeDataset([greatTusk, kingambit]);
    const coverage = threatCoverage([member(greatTusk)], dataset);

    expect(coverage.find(item => item.threatId === 'kingambit')?.covered).toBe(true);
  });

  it('tracks more than twelve threats by default', () => {
    const answer = makePokemon({id: 'greattusk', name: 'Great Tusk', usage: 30});
    const threats = Array.from({length: 18}, (_, index) => makePokemon({
      id: `threat-${index}`,
      name: `Threat ${index}`,
      usage: 29 - index
    }));
    const dataset = makeDataset([answer, ...threats]);

    expect(threatCoverage([member(answer)], dataset)).toHaveLength(18);
  });
});

describe('synergyInsights', () => {
  it('reports normalized teammate pairs for selected members', () => {
    const a = makePokemon({id: 'a', name: 'A', usage: 20, teammates: {b: 100}});
    const b = makePokemon({id: 'b', name: 'B', usage: 10, teammates: {a: 50}});

    expect(synergyInsights([member(a), member(b)])[0]).toMatchObject({a: 'a', b: 'b'});
    expect(synergyInsights([member(a), member(b)])[0].score).toBeGreaterThan(0);
  });
});
