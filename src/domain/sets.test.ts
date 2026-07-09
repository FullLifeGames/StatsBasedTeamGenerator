import {describe, expect, it} from 'vitest';
import {makePokemon} from '../test/fixtures';
import {inferFormatProfile} from './formatProfile';
import {buildSetCandidates, scoreSetForTeamContext} from './sets';
import type {FieldCondition} from './weather';

const greatTuskStats = makePokemon({
  id: 'greattusk',
  name: 'Great Tusk',
  abilities: {protosynthesis: 100},
  items: {boosterenergy: 60, rockyhelmet: 40},
  spreads: {'Jolly:0/252/4/0/0/252': 80},
  moves: {rapidspin: 90, headlongrush: 90, stealthrock: 50, knockoff: 35, icespinner: 30},
  teraTypes: {steel: 40}
});

describe('buildSetCandidates ability resolution', () => {
  it('ignores the noability slot Showdown records for Mega formes', () => {
    // Showdown logs the pre-Mega slot as `noability`, and it outweighs No Guard.
    const raichu = makePokemon({
      id: 'raichumegay',
      name: 'Raichu-Mega-Y',
      abilities: {noability: 243, noguard: 89},
      moves: {zapcannon: 100, focusblast: 90, electroweb: 80, nastyplot: 70}
    });

    expect(buildSetCandidates(raichu, inferFormatProfile('gen9ou'))[0].ability).toBe('No Guard');
  });

  it('falls back to the dex when the stats offer no real ability', () => {
    const staraptor = makePokemon({
      id: 'staraptormega',
      name: 'Staraptor-Mega',
      abilities: {noability: 348},
      moves: {bravebird: 100, closecombat: 90, uturn: 80, roost: 70}
    });

    expect(buildSetCandidates(staraptor, inferFormatProfile('gen9ou'))[0].ability).toBe('Contrary');
  });

  it('still prefers the most-used real ability', () => {
    const excadrill = makePokemon({
      id: 'excadrill',
      name: 'Excadrill',
      abilities: {noability: 500, sandrush: 70, moldbreaker: 30},
      moves: {earthquake: 100, ironhead: 90, rapidspin: 80, swordsdance: 70}
    });

    expect(buildSetCandidates(excadrill, inferFormatProfile('gen9ou'))[0].ability).toBe('Sand Rush');
  });

  it('leaves abilities empty in generations before they existed', () => {
    const tauros = makePokemon({id: 'tauros', name: 'Tauros', moves: {bodyslam: 100, hyperbeam: 90}});
    expect(buildSetCandidates(tauros, inferFormatProfile('gen1ou'))[0].ability).toBe('');
  });

  it('gives a rain team member its rarely played rain ability at build time', () => {
    // The same share floor as the end-of-generation refit: 3.7% Swift Swim is
    // a real choice on a rain team even though the generic set pick would
    // dismiss anything under 4% as unplayed.
    const basculegion = makePokemon({
      id: 'basculegion',
      name: 'Basculegion',
      abilities: {adaptability: 963, swiftswim: 37},
      items: {choiceband: 100},
      moves: {wavecrash: 100, lastrespects: 95, aquajet: 90, flipturn: 85}
    });

    const [candidate] = buildSetCandidates(basculegion, inferFormatProfile('gen9ou'), {
      teamConditions: new Set<FieldCondition>(['rain'])
    });

    expect(candidate.ability).toBe('Swift Swim');
  });

  it('does not force a weather ability the format never plays, even on a matching team', () => {
    const whimsicott = makePokemon({
      id: 'whimsicott',
      name: 'Whimsicott',
      abilities: {prankster: 1000},
      items: {covertcloak: 100},
      moves: {tailwind: 100, moonblast: 95, encore: 90, protect: 85}
    });

    const [candidate] = buildSetCandidates(whimsicott, inferFormatProfile('gen9ou'), {
      teamConditions: new Set<FieldCondition>(['sun'])
    });

    expect(candidate.ability).toBe('Prankster');
  });
});

describe('buildSetCandidates', () => {
  it('builds likely sets from weighted Great Tusk stats', () => {
    const [set] = buildSetCandidates(greatTuskStats, inferFormatProfile('gen9ou'));

    expect(set.ability).toBe('Protosynthesis');
    expect(set.item).toBe('Booster Energy');
    expect(set.moves).toHaveLength(4);
    expect(set.moves).toContain('Rapid Spin');
    expect(set.evs).toBe('252 Atk / 4 Def / 252 Spe');
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

  it('selects at most one Hidden Power type', () => {
    const [candidate] = buildSetCandidates(makePokemon({
      id: 'zapdos',
      name: 'Zapdos',
      abilities: {pressure: 100},
      items: {leftovers: 100},
      spreads: {'Timid:0/0/0/252/4/252': 100},
      moves: {thunderbolt: 100, hiddenpowerice: 95, hiddenpowergrass: 90, hiddenpowerfire: 85, roost: 80},
      teraTypes: {}
    }), inferFormatProfile('gen7ou'));

    expect(candidate.moves.filter(move => move.startsWith('Hidden Power'))).toHaveLength(1);
    expect(candidate.moves).toContain('Roost');
  });

  it('uses a different viable item when item clause is active', () => {
    const profile = inferFormatProfile('gen9vgc2025regg');
    const [candidate] = buildSetCandidates(makePokemon({
      id: 'incineroar',
      name: 'Incineroar',
      abilities: {intimidate: 100},
      items: {sitrusberry: 120, safetygoggles: 100},
      spreads: {'Careful:252/4/0/0/252/0': 100},
      moves: {fakeout: 100, partingshot: 95, knockoff: 90, flareblitz: 85},
      teraTypes: {grass: 100}
    }), profile, {itemClause: true, usedItems: new Set(['Sitrus Berry'])});

    expect(candidate.item).toBe('Safety Goggles');
  });

  it('keeps Choice Scarf sets coherent by preferring attacks and Trick over generic status moves', () => {
    const [candidate] = buildSetCandidates(makePokemon({
      id: 'gholdengo',
      name: 'Gholdengo',
      abilities: {goodasgold: 100},
      items: {choicescarf: 100},
      spreads: {'Timid:0/0/0/252/4/252': 100},
      moves: {makeitrain: 100, shadowball: 95, recover: 85, nastyplot: 80, trick: 70, focusblast: 65},
      teraTypes: {steel: 100}
    }), inferFormatProfile('gen9ou'));

    expect(candidate.item).toBe('Choice Scarf');
    expect(candidate.moves).toContain('Trick');
    expect(candidate.moves).not.toContain('Recover');
    expect(candidate.moves).not.toContain('Nasty Plot');
  });

  it('allows Baton Pass as choice-lock utility instead of generic status moves', () => {
    const [candidate] = buildSetCandidates(makePokemon({
      id: 'jolteon',
      name: 'Jolteon',
      abilities: {voltabsorb: 100},
      items: {choicespecs: 100},
      spreads: {'Timid:0/0/0/252/4/252': 100},
      moves: {thunderbolt: 100, voltswitch: 95, wish: 90, batonpass: 60, shadowball: 55},
      teraTypes: {}
    }), inferFormatProfile('gen8ou'));

    expect(candidate.item).toBe('Choice Specs');
    expect(candidate.moves).toContain('Baton Pass');
    expect(candidate.moves).not.toContain('Wish');
  });

  it('keeps Assault Vest sets to damaging moves', () => {
    const [candidate] = buildSetCandidates(makePokemon({
      id: 'rillaboom',
      name: 'Rillaboom',
      abilities: {grassysurge: 100},
      items: {assaultvest: 100},
      spreads: {'Adamant:252/252/4/0/0/0': 100},
      moves: {woodhammer: 100, protect: 99, swordsdance: 98, grassyglide: 95, uturn: 90, fakeout: 85},
      teraTypes: {grass: 100}
    }), inferFormatProfile('gen9vgc2025regg'));

    expect(candidate.item).toBe('Assault Vest');
    expect(candidate.moves).toEqual(expect.arrayContaining(['Wood Hammer', 'Grassy Glide', 'U-turn', 'Fake Out']));
    expect(candidate.moves).not.toContain('Protect');
    expect(candidate.moves).not.toContain('Swords Dance');
  });

  it('repairs Body Press sets by pairing them with Defense setup instead of redundant Fighting attacks', () => {
    const [candidate] = buildSetCandidates(makePokemon({
      id: 'zamazenta',
      name: 'Zamazenta',
      abilities: {dauntlessshield: 100},
      items: {leftovers: 100},
      spreads: {'Jolly:0/252/4/0/0/252': 100},
      moves: {closecombat: 100, bodypress: 98, crunch: 90, stoneedge: 85, irondefense: 72},
      teraTypes: {fighting: 100}
    }), inferFormatProfile('gen9ou'));

    expect(candidate.moves).toContain('Body Press');
    expect(candidate.moves).toContain('Iron Defense');
    expect(candidate.moves).not.toContain('Close Combat');
  });

  it('does not put Body Press on Choice Band sets when better Attack-based coverage exists', () => {
    const [candidate] = buildSetCandidates(makePokemon({
      id: 'zamazenta',
      name: 'Zamazenta',
      abilities: {dauntlessshield: 100},
      items: {choiceband: 100},
      spreads: {'Jolly:0/252/4/0/0/252': 100},
      moves: {bodypress: 110, closecombat: 100, crunch: 95, heavyslam: 90, wildcharge: 85, irondefense: 80},
      teraTypes: {fighting: 100}
    }), inferFormatProfile('gen9ou'));

    expect(candidate.item).toBe('Choice Band');
    expect(candidate.moves).toContain('Close Combat');
    expect(candidate.moves).not.toContain('Body Press');
    expect(candidate.moves).not.toContain('Iron Defense');
  });

  it('prefers Smogon analysis templates over marginal usage moves for set cohesion', () => {
    const [candidate] = buildSetCandidates(makePokemon({
      id: 'baxcalibur',
      name: 'Baxcalibur',
      abilities: {thermalexchange: 100},
      items: {loadeddice: 100},
      spreads: {'Jolly:0/252/4/0/0/252': 100},
      moves: {glaiverush: 100, earthquake: 95, icefang: 90, swordsdance: 85, scaleshot: 70, iciclespear: 65},
      teraTypes: {dragon: 100},
      analysisSets: [{
        name: 'Dragon Dance',
        ability: 'Thermal Exchange',
        item: 'Loaded Dice',
        nature: 'Jolly',
        evs: {atk: 252, def: 4, spe: 252},
        moves: ['Scale Shot', 'Icicle Spear', 'Earthquake', 'Dragon Dance']
      }]
    }), inferFormatProfile('gen9ou'));

    expect(candidate.source).toBe('analysis');
    expect(candidate.item).toBe('Loaded Dice');
    expect(candidate.moves).toEqual(['Scale Shot', 'Icicle Spear', 'Earthquake', 'Dragon Dance']);
  });

  it('never gives an analysis set an item in a generation without items', () => {
    // Gen 1 templates carry no item, and the raw stats fallback's top entry is
    // literally `nothing`, which previously rendered as "Tauros @ Nothing".
    const [candidate] = buildSetCandidates(makePokemon({
      id: 'tauros',
      name: 'Tauros',
      items: {nothing: 1000},
      moves: {bodyslam: 100, hyperbeam: 95, blizzard: 90, earthquake: 85},
      analysisSets: [{
        name: 'Standard',
        moves: ['Body Slam', 'Hyper Beam', 'Blizzard', 'Earthquake']
      }]
    }), inferFormatProfile('gen1ou'));

    expect(candidate.source).toBe('analysis');
    expect(candidate.item).toBe('');
    expect(candidate.itemId).toBeUndefined();
  });

  it('grades an analysis set by how close it stays to what is actually played', () => {
    const stats = {
      id: 'baxcalibur',
      name: 'Baxcalibur',
      abilities: {thermalexchange: 100},
      items: {loadeddice: 100},
      moves: {scaleshot: 100, iciclespear: 95, earthquake: 90, dragondance: 85},
      teraTypes: {dragon: 100}
    };
    const [aligned] = buildSetCandidates(makePokemon({
      ...stats,
      analysisSets: [{name: 'Standard', ability: 'Thermal Exchange', item: 'Loaded Dice', moves: ['Scale Shot', 'Icicle Spear', 'Earthquake', 'Dragon Dance']}]
    }), inferFormatProfile('gen9ou'));
    const [offMeta] = buildSetCandidates(makePokemon({
      ...stats,
      analysisSets: [{name: 'Off-meta', ability: 'Rattled', item: 'Heavy-Duty Boots', moves: ['Ice Beam', 'Surf', 'Blizzard', 'Rest']}]
    }), inferFormatProfile('gen9ou'));

    expect(aligned.confidence).toBeGreaterThan(offMeta.confidence);
    expect(offMeta.confidence).toBeGreaterThanOrEqual(0.5);
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
