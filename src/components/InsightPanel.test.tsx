import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
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
    teraTypes: {steel: 100},
    teammates: {greattusk: 500}
  }),
  makePokemon({
    id: 'kingambit',
    name: 'Kingambit',
    usage: 25,
    abilities: {supremeoverlord: 100},
    items: {blackglasses: 65},
    spreads: {'Adamant:112/252/0/0/0/144': 100},
    moves: {kowtowcleave: 100, suckerpunch: 95, ironthead: 80, swordsdance: 70},
    teraTypes: {dark: 100},
    teammates: {greattusk: 50}
  })
]);

describe('InsightPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows score details and Showdown import text for a generated team', () => {
    const team = generateTeam(dataset, 'gen91v1', {
      seeds: ['Great Tusk'],
      archetype: 'balanced',
      novelty: 0.2
    });

    render(<InsightPanel team={team} />);

    expect(screen.getByText('Showdown import')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Synergy'})).toBeInTheDocument();
    expect(screen.getByText('Great Tusk + Gholdengo')).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Great Tusk/)).toBeInTheDocument();
  });

  it('shows Showdown validation results when they are available', () => {
    const team = {
      ...generateTeam(dataset, 'gen91v1', {
        seeds: ['Great Tusk'],
        archetype: 'balanced',
        novelty: 0.2
      }),
      validation: {
        status: 'invalid' as const,
        formatName: '[Gen 9] 1v1',
        problems: ['You must bring at least 1 Pokemon.']
      }
    };

    render(<InsightPanel team={team} />);

    expect(screen.getByRole('heading', {name: 'Showdown validation'})).toBeInTheDocument();
    expect(screen.getByText('Needs fixes for [Gen 9] 1v1')).toBeInTheDocument();
    expect(screen.getByText('You must bring at least 1 Pokemon.')).toBeInTheDocument();
  });

  it('shows which team members answer each tracked threat', () => {
    const team = generateTeam(makeDataset([
      makePokemon({
        id: 'greattusk',
        name: 'Great Tusk',
        usage: 35,
        moves: {earthquake: 100, rapidspin: 90, knockoff: 80, headlongrush: 70},
        checks: [{target: 'kingambit', samples: 80, probability: 0.7, deviation: 0.05}]
      }),
      makePokemon({
        id: 'gholdengo',
        name: 'Gholdengo',
        usage: 30,
        moves: {shadowball: 100, makeitrain: 90, trick: 70, focusblast: 60}
      }),
      makePokemon({
        id: 'dragapult',
        name: 'Dragapult',
        usage: 29,
        moves: {dracometeor: 100, shadowball: 90, uturn: 80, thunderwave: 70}
      }),
      makePokemon({
        id: 'kingambit',
        name: 'Kingambit',
        usage: 5,
        moves: {kowtowcleave: 100, suckerpunch: 95, ironhead: 80, swordsdance: 70}
      })
    ]), 'gen91v1', {
      seeds: ['Great Tusk'],
      archetype: 'balanced',
      novelty: 0
    });

    render(<InsightPanel team={team} />);

    expect(screen.getByText(/Covered by Great Tusk/)).toBeInTheDocument();
  });

  it('shows threat coverage as unavailable when the stats file has no checks and counters data', () => {
    const team = generateTeam(dataset, 'gen91v1', {
      seeds: ['Great Tusk'],
      archetype: 'balanced',
      novelty: 0
    });

    render(<InsightPanel team={team} />);

    expect(screen.getByText('Checks and counters data is not available for this stats file.')).toBeInTheDocument();
    expect(screen.queryByText(/tracked threats covered/)).not.toBeInTheDocument();
  });

  it('copies the Showdown importable text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: {writeText}
    });
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: {writeText}
    });
    expect(window.navigator.clipboard.writeText).toBe(writeText);
    const team = generateTeam(dataset, 'gen91v1', {
      seeds: ['Great Tusk'],
      archetype: 'balanced',
      novelty: 0.2
    });

    render(<InsightPanel team={team} />);
    fireEvent.click(screen.getByRole('button', {name: /copy importable/i}));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(team.importable));
    expect(await screen.findByRole('button', {name: /copied/i})).toBeInTheDocument();
  });
});
