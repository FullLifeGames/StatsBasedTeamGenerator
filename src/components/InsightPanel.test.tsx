import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {generateTeam} from '../domain/generator';
import {makeDataset, makePokemon} from '../test/fixtures';
import {InsightPanel} from './InsightPanel';

const dataset = makeDataset([
  makePokemon({
    id: 'greattusk',
    name: 'Great Tusk',
    usage: 35,
    abilities: {protosynthesis: 100},
    items: {boosterenergy: 80},
    spreads: {'Jolly:0/252/0/0/4/252': 100},
    moves: {earthquake: 100, rapidspin: 90, knockoff: 80, headlongrush: 70},
    teraTypes: {ground: 100}
  }),
  makePokemon({
    id: 'gholdengo',
    name: 'Gholdengo',
    usage: 30,
    abilities: {goodasgold: 100},
    items: {choicescarf: 75},
    spreads: {'Timid:0/0/0/252/4/252': 100},
    moves: {shadowball: 100, makeitrain: 90, trick: 70, focusblast: 60},
    teraTypes: {steel: 100}
  }),
  makePokemon({
    id: 'kingambit',
    name: 'Kingambit',
    usage: 25,
    abilities: {supremeoverlord: 100},
    items: {blackglasses: 65},
    spreads: {'Adamant:112/252/0/0/0/144': 100},
    moves: {kowtowcleave: 100, suckerpunch: 95, ironthead: 80, swordsdance: 70},
    teraTypes: {dark: 100}
  })
]);

describe('InsightPanel', () => {
  it('shows score details and Showdown import text for a generated team', () => {
    const team = generateTeam(dataset, 'gen91v1', {
      seeds: ['Great Tusk'],
      archetype: 'balanced',
      novelty: 0.2
    });

    render(<InsightPanel team={team} />);

    expect(screen.getByText('Showdown import')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Great Tusk/)).toBeInTheDocument();
  });
});
