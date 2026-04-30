import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {generateTeam} from '../domain/generator';
import {makeDataset, makePokemon} from '../test/fixtures';
import {TeamBoard} from './TeamBoard';

const dataset = makeDataset([
  makePokemon({
    id: 'greattusk',
    name: 'Great Tusk',
    usage: 35,
    abilities: {protosynthesis: 100},
    items: {leftovers: 100},
    moves: {earthquake: 100, rapidspin: 90, knockoff: 80, stealthrock: 70}
  })
]);

describe('TeamBoard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('copies the generated Showdown import from the team header', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: {writeText}
    });
    const team = generateTeam(dataset, 'gen91v1', {
      seeds: ['Great Tusk'],
      archetype: 'balanced',
      novelty: 0
    });

    render(<TeamBoard team={team} />);
    fireEvent.click(screen.getByRole('button', {name: /copy importable/i}));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(team.importable));
    expect(await screen.findByRole('button', {name: /copied/i})).toBeInTheDocument();
  });
});
