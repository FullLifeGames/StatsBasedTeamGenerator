import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {makeDataset, makePokemon} from './test/fixtures';
import type {StatsDataset, StatsIndex} from './domain/types';
import {App} from './App';

const index: StatsIndex = {
  months: ['2026-03'],
  latestMonth: '2026-03',
  formats: [
    {id: 'gen9ou', name: 'Gen 9 OU', month: '2026-03', cutoffs: [1825]},
    {id: 'gen91v1', name: 'Gen 9 1v1', month: '2026-03', cutoffs: [1500]}
  ]
};

const oneVsOneDataset: StatsDataset = {
  ...makeDataset([
    makePokemon({
      id: 'greattusk',
      name: 'Great Tusk',
      usage: 35,
      abilities: {protosynthesis: 100},
      items: {boosterenergy: 80, leftovers: 20},
      spreads: {'Jolly:0/252/0/0/4/252': 100},
      moves: {earthquake: 100, rapidspin: 80, knockoff: 70, headlongrush: 60},
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
  ]),
  source: {
    month: '2026-03',
    format: 'gen91v1',
    cutoff: 1500,
    url: 'https://www.smogon.com/stats/2026-03/chaos/gen91v1-1500.json'
  }
};

function stubFetch(): void {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url === '/api/stats/index') {
      return {ok: true, json: () => Promise.resolve(index)};
    }

    if (url === '/api/stats/2026-03/gen91v1/1500') {
      return {ok: true, json: () => Promise.resolve(oneVsOneDataset)};
    }

    return {
      ok: false,
      status: 404,
      json: () => Promise.resolve({message: `Missing fixture for ${url}`})
    };
  }));
}

describe('App', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('generates a team from selected controls', async () => {
    stubFetch();
    const user = userEvent.setup();

    render(<App />);

    const formatSelect = await screen.findByLabelText('Format');
    await user.selectOptions(formatSelect, 'gen91v1');
    await user.click(screen.getByRole('button', {name: /generate team/i}));

    await waitFor(() => expect(screen.getByText('Great Tusk')).toBeInTheDocument());
  });

  it('marks a card as locked from the team board controls', async () => {
    stubFetch();
    const user = userEvent.setup();

    render(<App />);

    const formatSelect = await screen.findByLabelText('Format');
    await user.selectOptions(formatSelect, 'gen91v1');
    await user.click(screen.getByRole('button', {name: /generate team/i}));

    const lockButton = await screen.findByRole('button', {name: /lock great tusk/i});
    await user.click(lockButton);

    expect(lockButton).toHaveAttribute('aria-pressed', 'true');
  });
});
