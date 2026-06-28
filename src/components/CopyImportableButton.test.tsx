import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {CopyImportableButton} from './CopyImportableButton';

describe('CopyImportableButton', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resets copied state when the importable text changes', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: {writeText}
    });
    const {rerender} = render(<CopyImportableButton importable="first team" />);

    fireEvent.click(screen.getByRole('button', {name: /copy importable/i}));

    await waitFor(() => expect(screen.getByRole('button', {name: /copied/i})).toBeInTheDocument());

    rerender(<CopyImportableButton importable="second team" />);

    expect(screen.getByRole('button', {name: /copy importable/i})).toBeInTheDocument();
  });
});
