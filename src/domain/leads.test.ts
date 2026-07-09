import {describe, expect, it} from 'vitest';
import {makeDataset, makePokemon} from '../test/fixtures';
import {inferFormatProfile} from './formatProfile';
import {applyLead, attachLeads, bestLeadMember, leadScore, parseLeads} from './leads';
import {buildSetCandidates} from './sets';
import type {PokemonStats, TeamMember} from './types';

const leadsTable = `Total leads: 37434
+ ---- + ------------------ + --------- + ------ + ------- +
| Rank | Pokemon            | Usage %   | Raw    | %       |
+ ---- + ------------------ + --------- + ------ + ------- +
| 1    | Jynx               | 22.62514% | 6393   | 17.078% |
| 2    | Starmie            | 19.78331% | 6729   | 17.976% |
| 3    | Alakazam           | 15.86707% | 5360   | 14.319% |
| 4    | Tauros             |  6.85119% | 1645   |  4.394% |
+ ---- + ------------------ + --------- + ------ + ------- +
`;

function member(stats: PokemonStats, format = 'gen1ou'): TeamMember {
  return {stats, set: buildSetCandidates(stats, inferFormatProfile(format))[0], explanation: []};
}

function gen1Dataset() {
  const dataset = makeDataset([
    makePokemon({id: 'jynx', name: 'Jynx', usage: 37, moves: {lovelykiss: 100, psychic: 90}}),
    makePokemon({id: 'starmie', name: 'Starmie', usage: 60, moves: {psychic: 100, recover: 90}}),
    makePokemon({id: 'tauros', name: 'Tauros', usage: 98, moves: {bodyslam: 100, hyperbeam: 90}}),
    makePokemon({id: 'rhydon', name: 'Rhydon', usage: 25, moves: {earthquake: 100, rockslide: 90}})
  ]);
  return attachLeads(dataset, parseLeads(leadsTable));
}

describe('parseLeads', () => {
  it('reads the fixed-width leads table', () => {
    expect(parseLeads(leadsTable)).toEqual({
      jynx: 22.62514,
      starmie: 19.78331,
      alakazam: 15.86707,
      tauros: 6.85119
    });
  });

  it('ignores headers, separators, and totals', () => {
    expect(parseLeads('Total leads: 100\n+ ---- +\n| Rank | Pokemon | Usage % |\n')).toEqual({});
  });

  it('tolerates an empty response', () => {
    expect(parseLeads('')).toEqual({});
  });
});

describe('attachLeads', () => {
  it('gives Pokemon without lead data a usage of zero', () => {
    const dataset = gen1Dataset();
    expect(dataset.pokemonById.jynx.leadUsage).toBeCloseTo(22.625, 3);
    expect(dataset.pokemonById.rhydon.leadUsage).toBe(0);
  });
});

describe('leadScore', () => {
  it('rewards a team that brings the strongest lead', () => {
    const dataset = gen1Dataset();
    const profile = inferFormatProfile('gen1ou');
    const withJynx = [member(dataset.pokemonById.jynx), member(dataset.pokemonById.tauros)];

    expect(leadScore(withJynx, dataset, profile)).toBeCloseTo(1.5, 5);
  });

  it('scores a weaker lead proportionally', () => {
    const dataset = gen1Dataset();
    const profile = inferFormatProfile('gen1ou');
    const withTauros = [member(dataset.pokemonById.tauros), member(dataset.pokemonById.rhydon)];
    const withStarmie = [member(dataset.pokemonById.starmie), member(dataset.pokemonById.rhydon)];

    expect(leadScore(withTauros, dataset, profile)).toBeLessThan(leadScore(withStarmie, dataset, profile));
  });

  it('is zero for a team with no lead data at all', () => {
    const dataset = gen1Dataset();
    expect(leadScore([member(dataset.pokemonById.rhydon)], dataset, inferFormatProfile('gen1ou'))).toBe(0);
  });

  it('does not apply once team preview exists', () => {
    const dataset = gen1Dataset();
    expect(inferFormatProfile('gen9ou').usesLeads).toBe(false);
    expect(leadScore([member(dataset.pokemonById.jynx)], dataset, inferFormatProfile('gen9ou'))).toBe(0);
  });

  it('does not apply to doubles', () => {
    expect(inferFormatProfile('gen4doublesou').usesLeads).toBe(false);
    expect(inferFormatProfile('gen4ou').usesLeads).toBe(true);
  });
});

describe('bestLeadMember and applyLead', () => {
  it('moves the lead into the first slot, which is the Pokemon sent out', () => {
    const dataset = gen1Dataset();
    const members = [member(dataset.pokemonById.tauros), member(dataset.pokemonById.jynx)];

    expect(bestLeadMember(members)?.stats.id).toBe('jynx');

    const applied = applyLead(members, dataset, inferFormatProfile('gen1ou'));
    expect(applied.map(entry => entry.stats.id)).toEqual(['jynx', 'tauros']);
    expect(applied[0].lead).toBe(true);
    expect(applied[0].explanation).toContain('Leads: used as lead in 22.6% of games');
    expect(applied[1].lead).toBeUndefined();
  });

  it('keeps the rest of the team in order', () => {
    const dataset = gen1Dataset();
    const members = [
      member(dataset.pokemonById.tauros),
      member(dataset.pokemonById.rhydon),
      member(dataset.pokemonById.starmie)
    ];

    expect(applyLead(members, dataset, inferFormatProfile('gen1ou')).map(entry => entry.stats.id))
      .toEqual(['starmie', 'tauros', 'rhydon']);
  });

  it('does not reorder a format that has team preview', () => {
    const dataset = gen1Dataset();
    const members = [member(dataset.pokemonById.tauros), member(dataset.pokemonById.jynx)];

    const applied = applyLead(members, dataset, inferFormatProfile('gen9ou'));
    expect(applied.map(entry => entry.stats.id)).toEqual(['tauros', 'jynx']);
    expect(applied.every(entry => entry.lead === undefined)).toBe(true);
  });

  it('clears a stale lead flag carried in from an earlier generation', () => {
    const dataset = gen1Dataset();
    const stale: TeamMember = {...member(dataset.pokemonById.tauros), lead: true};
    const members = [stale, member(dataset.pokemonById.jynx)];

    const applied = applyLead(members, dataset, inferFormatProfile('gen1ou'));
    expect(applied.filter(entry => entry.lead).map(entry => entry.stats.id)).toEqual(['jynx']);
  });
});
