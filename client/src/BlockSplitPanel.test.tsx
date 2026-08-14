import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlockSplitPanel } from './BlockSplitPanel';
import { blockBoardStates } from './blockBranching';

afterEach(cleanup);

// Attacker with Block vs a plain defender: three live states plus a dead face,
// same fixture used throughout branchRun.test.ts.
const resolution = blockBoardStates(['Block'], []);

describe('BlockSplitPanel', () => {
  it('shows every live board state plus the turnover chance, no checkboxes', () => {
    render(
      <BlockSplitPanel
        attackerName="Aldric" defenderName="Grukk"
        diceCount={1} picker="attacker" resolution={resolution}
        onAccept={vi.fn()} onReject={vi.fn()}
      />,
    );

    expect(screen.getByText('Pushed + Down')).toBeTruthy();
    expect(screen.getByText('Down in place')).toBeTruthy();
    expect(screen.getByText('Pushed')).toBeTruthy();
    expect(screen.getByText('Turnover — drive ends here')).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('rolls on accept and backs out on reject', () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();
    render(
      <BlockSplitPanel
        attackerName="Aldric" defenderName="Grukk"
        diceCount={1} picker="attacker" resolution={resolution}
        onAccept={onAccept} onReject={onReject}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Roll the Dice/ }));
    expect(onAccept).toHaveBeenCalledOnce();
    expect(onReject).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Cancel/ }));
    expect(onReject).toHaveBeenCalledOnce();
  });

  it('names who picks, matching the dice graphic', () => {
    const { rerender } = render(
      <BlockSplitPanel
        attackerName="Aldric" defenderName="Grukk"
        diceCount={2} picker="defender" resolution={resolution}
        onAccept={vi.fn()} onReject={vi.fn()}
      />,
    );
    expect(screen.getByText(/the defender picks which one counts/)).toBeTruthy();

    rerender(
      <BlockSplitPanel
        attackerName="Aldric" defenderName="Grukk"
        diceCount={2} picker="attacker" resolution={resolution}
        onAccept={vi.fn()} onReject={vi.fn()}
      />,
    );
    expect(screen.getByText(/you pick which one counts/)).toBeTruthy();
  });
});
