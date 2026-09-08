import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RunOutcomeDialog } from './RunOutcomeDialog';

afterEach(cleanup);

describe('RunOutcomeDialog', () => {
  it('blocks a failed drive with restart and exit choices', () => {
    const onRestart = vi.fn();
    const onExit = vi.fn();
    render(<RunOutcomeDialog variant="failed" objective="touchdown" onRestart={onRestart} onExit={onExit} />);

    expect(screen.getByRole('alertdialog', { name: 'Drive failed' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Restart Puzzle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exit Puzzle' }));
    expect(onRestart).toHaveBeenCalledOnce();
    expect(onExit).toHaveBeenCalledOnce();
  });

  it('explains why an impossible crowd-surf run failed', () => {
    render(<RunOutcomeDialog variant="failed" objective="crowd-surf" onRestart={vi.fn()} onExit={vi.fn()} />);

    expect(screen.getByText(/No standing player can make a legal Block or Blitz/i)).toBeTruthy();
  });

  it('explains a scored branch and continues to unfinished universes', () => {
    const onContinue = vi.fn();
    render(
      <RunOutcomeDialog
        variant="unfinished-branches"
        remainingBranches={2}
        onContinue={onContinue}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Touchdown, but the run is not finished' })).toBeTruthy();
    expect(screen.getByText(/2 universes remain unresolved/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continue Remaining Branches' }));
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
