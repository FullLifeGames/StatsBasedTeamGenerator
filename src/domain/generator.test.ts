import {describe, expect, it} from 'vitest';
import {makeDataset, makePokemon} from '../test/fixtures';
import {inferFormatProfile} from './formatProfile';
import {generateTeam} from './generator';
import {buildSetCandidates} from './sets';
import type {PokemonStats, TeamMember} from './types';

function ouPokemon(overrides: Partial<PokemonStats> & Pick<PokemonStats, 'id' | 'name'>): PokemonStats {
  return makePokemon({
    usage: 10,
    rawCount: 1000,
    viability: 80,
    abilities: {protosynthesis: 100},
    items: {leftovers: 100},
    spreads: {'Jolly:0/252/4/0/0/252': 100},
    moves: {earthquake: 100, knockoff: 90, uturn: 80, toxic: 70},
    teraTypes: {steel: 100},
    ...overrides
  });
}

function lockedMember(stats: PokemonStats): TeamMember {
  const profile = inferFormatProfile('gen9ou');
  return {
    stats,
    set: buildSetCandidates(stats, profile)[0],
    locked: true,
    explanation: ['Locked by user']
  };
}

describe('generateTeam', () => {
  it('keeps seed Pokemon and fills to format team size', () => {
    const greatTusk = ouPokemon({
      id: 'greattusk',
      name: 'Great Tusk',
      usage: 34,
      moves: {rapidspin: 100, headlongrush: 95, knockoff: 80, icespinner: 70, stealthrock: 50}
    });
    const dataset = makeDataset([
      greatTusk,
      ouPokemon({id: 'kingambit', name: 'Kingambit', usage: 31, moves: {kowtowcleave: 100, suckerpunch: 95, ironhead: 80, swordsdance: 70}}),
      ouPokemon({id: 'gholdengo', name: 'Gholdengo', usage: 28, abilities: {goodasgold: 100}, moves: {makeitrain: 100, shadowball: 95, recover: 60, nastyplot: 50}}),
      ouPokemon({id: 'dragapult', name: 'Dragapult', usage: 24, moves: {dracometeor: 100, shadowball: 95, uturn: 85, thunderwave: 60}}),
      ouPokemon({id: 'samurotthisui', name: 'Samurott-Hisui', usage: 18, moves: {ceaselessedge: 100, knockoff: 90, aquajet: 80, swordsdance: 60}}),
      ouPokemon({id: 'ironvaliant', name: 'Iron Valiant', usage: 22, abilities: {quarkdrive: 100}, moves: {moonblast: 100, closecombat: 90, knockoff: 80, thunderwave: 70}})
    ]);

    const team = generateTeam(dataset, 'gen9ou', {seeds: ['greattusk'], archetype: 'balanced', novelty: 0});

    expect(team.members).toHaveLength(6);
    expect(team.members[0].stats.id).toBe('greattusk');
    expect(team.members.map(member => member.stats.id)).toContain('greattusk');
    expect(team.importable).toContain('Great Tusk');
    expect(team.score.total).toBeGreaterThan(0);
  });

  it('does not select the same Pokemon twice', () => {
    const dataset = makeDataset([
      ouPokemon({id: 'greattusk', name: 'Great Tusk', usage: 30}),
      ouPokemon({id: 'kingambit', name: 'Kingambit', usage: 28}),
      ouPokemon({id: 'gholdengo', name: 'Gholdengo', usage: 25})
    ]);

    const team = generateTeam(dataset, 'gen91v1', {seeds: [], archetype: 'balanced', novelty: 0});
    const memberIds = team.members.map(member => member.stats.id);

    expect(team.members).toHaveLength(3);
    expect(new Set(memberIds).size).toBe(memberIds.length);
  });

  it('enforces species clause across alternate forms', () => {
    const dataset = makeDataset([
      ouPokemon({id: 'ogerponwellspring', name: 'Ogerpon-Wellspring', usage: 40}),
      ouPokemon({id: 'ogerponhearthflame', name: 'Ogerpon-Hearthflame', usage: 39}),
      ouPokemon({id: 'urshifurapidstrike', name: 'Urshifu-Rapid-Strike', usage: 38}),
      ouPokemon({id: 'urshifu', name: 'Urshifu', usage: 37}),
      ouPokemon({id: 'kingambit', name: 'Kingambit', usage: 36}),
      ouPokemon({id: 'gholdengo', name: 'Gholdengo', usage: 35})
    ]);

    const team = generateTeam(dataset, 'gen91v1', {seeds: [], archetype: 'balanced', novelty: 0});
    const memberIds = team.members.map(member => member.stats.id);

    expect(memberIds.filter(id => id.startsWith('ogerpon'))).toHaveLength(1);
    expect(memberIds.filter(id => id.startsWith('urshifu'))).toHaveLength(1);
  });

  it('enforces item clause in VGC formats', () => {
    const dataset = makeDataset([
      ouPokemon({id: 'incineroar', name: 'Incineroar', usage: 40, items: {sitrusberry: 200, safetygoggles: 80}, moves: {fakeout: 100, partingshot: 95, knockoff: 90, flareblitz: 85}}),
      ouPokemon({id: 'rillaboom', name: 'Rillaboom', usage: 39, abilities: {grassysurge: 100}, items: {sitrusberry: 200, assaultvest: 150}, moves: {fakeout: 100, grassyglide: 90, woodhammer: 85, uturn: 80}}),
      ouPokemon({id: 'flutter-mane', name: 'Flutter Mane', usage: 38, items: {boosterenergy: 100}, moves: {moonblast: 100, shadowball: 90, icywind: 80, protect: 70}}),
      ouPokemon({id: 'urshifurapidstrike', name: 'Urshifu-Rapid-Strike', usage: 37, items: {choicescarf: 100}, moves: {surgingstrikes: 100, closecombat: 90, aquajet: 80, protect: 70}})
    ]);

    const team = generateTeam(dataset, 'gen9vgc2025regg', {seeds: [], archetype: 'balanced', novelty: 0});
    const items = team.members.map(member => member.set.item).filter(Boolean);

    expect(new Set(items).size).toBe(items.length);
  });

  it('preserves locked members from options', () => {
    const garganacl = ouPokemon({
      id: 'garganacl',
      name: 'Garganacl',
      usage: 14,
      moves: {recover: 100, stealthrock: 75, earthquake: 70, toxic: 60}
    });
    const dataset = makeDataset([
      garganacl,
      ouPokemon({id: 'greattusk', name: 'Great Tusk', usage: 30}),
      ouPokemon({id: 'kingambit', name: 'Kingambit', usage: 28})
    ]);

    const team = generateTeam(dataset, 'gen9ou', {
      seeds: ['garganacl'],
      lockedMembers: [lockedMember(garganacl)],
      archetype: 'balanced',
      novelty: 0
    });

    expect(team.members[0].stats.id).toBe('garganacl');
    expect(team.members[0].locked).toBe(true);
    expect(team.members.filter(member => member.stats.id === 'garganacl')).toHaveLength(1);
  });

  it('builds later sets with existing role context to avoid redundant singles hazards', () => {
    const tingLu = ouPokemon({
      id: 'tinglu',
      name: 'Ting-Lu',
      usage: 35,
      abilities: {vesselofruin: 100},
      items: {leftovers: 100},
      spreads: {'Careful:252/0/4/0/252/0': 100},
      moves: {stealthrock: 100, spikes: 95, ruination: 80, whirlwind: 70}
    });
    const greatTusk = ouPokemon({
      id: 'greattusk',
      name: 'Great Tusk',
      usage: 34,
      moves: {stealthrock: 5000, rapidspin: 4800, headlongrush: 4700, knockoff: 4600, icespinner: 4500}
    });
    const dataset = makeDataset([tingLu, greatTusk]);

    const team = generateTeam(dataset, 'gen9ou', {
      seeds: [],
      lockedMembers: [lockedMember(tingLu)],
      archetype: 'balanced',
      novelty: 0
    });

    const generatedGreatTusk = team.members.find(member => member.stats.id === 'greattusk');
    expect(generatedGreatTusk?.set.moves).not.toContain('Stealth Rock');
    expect(generatedGreatTusk?.set.moves).toContain('Rapid Spin');
  });

  it('includes archetype fit in generated team scoring', () => {
    const dataset = makeDataset([
      ouPokemon({id: 'pelipper', name: 'Pelipper', usage: 20, abilities: {drizzle: 100}, moves: {hurricane: 100, uturn: 80, roost: 70}}),
      ouPokemon({id: 'barraskewda', name: 'Barraskewda', usage: 19, abilities: {swiftswim: 100}, moves: {liquidation: 100, closecombat: 90, flipturn: 80}}),
      ouPokemon({id: 'kingambit', name: 'Kingambit', usage: 30, moves: {kowtowcleave: 100, suckerpunch: 95, ironhead: 80, swordsdance: 70}})
    ]);

    const balanced = generateTeam(dataset, 'gen91v1', {seeds: [], archetype: 'balanced', novelty: 0});
    const weather = generateTeam(dataset, 'gen91v1', {seeds: [], archetype: 'weather', novelty: 0});

    expect(weather.score.archetype).toBeGreaterThan(0);
    expect(weather.score.total).toBeGreaterThan(balanced.score.total);
  });

  it('forces weather and trick-room anchors when those archetypes are requested', () => {
    const weatherDataset = makeDataset([
      ouPokemon({id: 'kingambit', name: 'Kingambit', usage: 60, moves: {kowtowcleave: 100, suckerpunch: 95, ironhead: 80, swordsdance: 70}}),
      ouPokemon({id: 'gholdengo', name: 'Gholdengo', usage: 55, abilities: {goodasgold: 100}, moves: {makeitrain: 100, shadowball: 95, recover: 60, nastyplot: 50}}),
      ouPokemon({id: 'pelipper', name: 'Pelipper', usage: 8, abilities: {drizzle: 100}, moves: {hurricane: 100, uturn: 90, roost: 80, weatherball: 70}}),
      ouPokemon({id: 'barraskewda', name: 'Barraskewda', usage: 7, abilities: {swiftswim: 100}, moves: {liquidation: 100, closecombat: 90, flipturn: 80, aquajet: 70}})
    ]);
    const trickRoomDataset = makeDataset([
      ouPokemon({id: 'flutter-mane', name: 'Flutter Mane', usage: 60, moves: {moonblast: 100, shadowball: 95, protect: 80, icywind: 70}}),
      ouPokemon({id: 'incineroar', name: 'Incineroar', usage: 55, moves: {fakeout: 100, partingshot: 95, knockoff: 80, flareblitz: 70}}),
      ouPokemon({id: 'cresselia', name: 'Cresselia', usage: 8, moves: {trickroom: 100, helpinghand: 90, moonblast: 80, protect: 70}}),
      ouPokemon({id: 'ursaluna', name: 'Ursaluna', usage: 7, moves: {facade: 100, headlongrush: 90, protect: 80, earthquake: 70}})
    ]);

    expect(generateTeam(weatherDataset, 'gen9ou', {seeds: [], archetype: 'weather', novelty: 0}).members.map(member => member.stats.id))
      .toEqual(expect.arrayContaining(['pelipper', 'barraskewda']));
    expect(generateTeam(trickRoomDataset, 'gen9vgc2025regg', {seeds: [], archetype: 'trick-room', novelty: 0}).members.map(member => member.stats.id))
      .toEqual(expect.arrayContaining(['cresselia', 'ursaluna']));
  });

  it('uses seeded novelty to vary equally strong teams', () => {
    const dataset = makeDataset([
      ouPokemon({id: 'alpha', name: 'Alpha', usage: 30}),
      ouPokemon({id: 'bravo', name: 'Bravo', usage: 30}),
      ouPokemon({id: 'charlie', name: 'Charlie', usage: 30}),
      ouPokemon({id: 'delta', name: 'Delta', usage: 30}),
      ouPokemon({id: 'echo', name: 'Echo', usage: 30}),
      ouPokemon({id: 'foxtrot', name: 'Foxtrot', usage: 30})
    ]);

    const first = generateTeam(dataset, 'gen91v1', {seeds: [], archetype: 'balanced', novelty: 0.25, randomSeed: 1});
    const second = generateTeam(dataset, 'gen91v1', {seeds: [], archetype: 'balanced', novelty: 0.25, randomSeed: 2});

    expect(first.members.map(member => member.stats.id).join(',')).not.toBe(second.members.map(member => member.stats.id).join(','));
  });

  it('uses seeded novelty when several high-scoring teams are close', () => {
    const dataset = makeDataset([
      ouPokemon({id: 'greattusk', name: 'Great Tusk', usage: 40, moves: {rapidspin: 100, headlongrush: 95, knockoff: 90, icespinner: 80}}),
      ouPokemon({id: 'kingambit', name: 'Kingambit', usage: 39, moves: {kowtowcleave: 100, suckerpunch: 95, ironhead: 80, swordsdance: 70}}),
      ouPokemon({id: 'gholdengo', name: 'Gholdengo', usage: 38, abilities: {goodasgold: 100}, moves: {makeitrain: 100, shadowball: 95, recover: 60, nastyplot: 50}}),
      ouPokemon({id: 'dragapult', name: 'Dragapult', usage: 37, moves: {dracometeor: 100, shadowball: 95, uturn: 85, thunderwave: 60}}),
      ouPokemon({id: 'samurotthisui', name: 'Samurott-Hisui', usage: 36, moves: {ceaselessedge: 100, knockoff: 90, aquajet: 80, swordsdance: 60}}),
      ouPokemon({id: 'ironvaliant', name: 'Iron Valiant', usage: 35, moves: {moonblast: 100, closecombat: 95, knockoff: 80, thunderwave: 70}}),
      ouPokemon({id: 'roaringmoon', name: 'Roaring Moon', usage: 34, moves: {knockoff: 100, earthquake: 90, uturn: 80, dragondance: 70}}),
      ouPokemon({id: 'glimmora', name: 'Glimmora', usage: 33, moves: {stealthrock: 100, mortalspin: 90, sludgewave: 80, earthpower: 70}}),
      ouPokemon({id: 'tornadustherian', name: 'Tornadus-Therian', usage: 32, moves: {bleakwindstorm: 100, uturn: 90, knockoff: 80, tailwind: 70}})
    ]);

    const teams = [11, 22, 33, 44].map(randomSeed => generateTeam(dataset, 'gen9ou', {
      seeds: [],
      archetype: 'balanced',
      novelty: 0.35,
      randomSeed
    }).members.map(member => member.stats.id).join(','));

    expect(new Set(teams).size).toBeGreaterThan(1);
  });
});
