import type {ComponentProps} from 'react';
import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {ControlRail} from './ControlRail';

const index = {
  months: ['2026-03'],
  latestMonth: '2026-03',
  formats: [
    {id: 'gen9ou', name: 'Gen 9 OU', month: '2026-03', cutoffs: [1825]}
  ]
};

function renderControlRail(overrides: Partial<ComponentProps<typeof ControlRail>> = {}) {
  const props: ComponentProps<typeof ControlRail> = {
    index,
    month: '2026-03',
    format: 'gen9ou',
    cutoff: 1825,
    archetype: 'balanced',
    loading: false,
    generating: false,
    availableFormats: index.formats,
    availableCutoffs: [1825],
    setMonth: vi.fn(),
    setFormat: vi.fn(),
    setCutoff: vi.fn(),
    setArchetype: vi.fn(),
    generate: vi.fn(),
    darkMode: false,
    onToggleDarkMode: vi.fn(),
    ...overrides
  };

  return render(<ControlRail {...props} />);
}

describe('ControlRail', () => {
  it('offers hyper offense as an archetype', () => {
    renderControlRail();

    expect(screen.getByRole('option', {name: 'Hyper offense'})).toBeInTheDocument();
  });

  it('describes the selected archetype', () => {
    renderControlRail({archetype: 'stall'});

    expect(screen.getByText(/wins by outlasting/i)).toBeInTheDocument();
  });

  it('shows a busy state while team generation is loading', () => {
    renderControlRail({loading: true, generating: true});

    const button = screen.getByRole('button', {name: /generating team/i});
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.querySelector('.generate-button__spinner')).not.toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Generating team');
  });

  it('keeps the generate label during non-generation loading', () => {
    renderControlRail({loading: true, generating: false});

    expect(screen.getByRole('button', {name: /generate team/i})).toBeDisabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
