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
        attackerStrength={3} attackerAssists={0}
        defenderStrength={3} defenderAssists={0}
        diceCount={1} picker="attacker" resolution={resolution}
        onAccept={vi.fn()} onReject={vi.fn()}
      />,
    );

    expect(screen.getByText('Pushed + Down')).toBeTruthy();
    expect(screen.getByText('Down in place')).toBeTruthy();
    expect(screen.getByText('Pushed')).toBeTruthy();
    expect(screen.getByText('Turnover: drive ends here')).toBeTruthy();
    expect(screen.getByText('Attacker Down')).toBeTruthy();
    expect(screen.getByText('Possible outcomes')).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('rolls on accept and backs out on reject', () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();
    render(
      <BlockSplitPanel
        attackerName="Aldric" defenderName="Grukk"
        attackerStrength={3} attackerAssists={0}
        defenderStrength={3} defenderAssists={0}
        diceCount={1} picker="attacker" resolution={resolution}
        onAccept={onAccept} onReject={onReject}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Progress' }));
    expect(onAccept).toHaveBeenCalledOnce();
    expect(onReject).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Cancel/ }));
    expect(onReject).toHaveBeenCalledOnce();
  });

  it('explains the effective Strength calculation and uphill/downhill dice', () => {
    const { rerender } = render(
      <BlockSplitPanel
        attackerName="Aldric" defenderName="Grukk"
        attackerStrength={3} attackerAssists={0}
        defenderStrength={4} defenderAssists={0}
        diceCount={2} picker="defender" resolution={resolution}
        onAccept={vi.fn()} onReject={vi.fn()}
      />,
    );
    expect(screen.getByText('ST 3 + 0 assists = 3')).toBeTruthy();
    expect(screen.getByText('ST 4 + 0 assists = 4')).toBeTruthy();
    expect(screen.getByText('2 dice, uphill')).toBeTruthy();
    expect(screen.queryByText(/pick/i)).toBeNull();

    rerender(
      <BlockSplitPanel
        attackerName="Aldric" defenderName="Grukk"
        attackerStrength={3} attackerAssists={1}
        defenderStrength={3} defenderAssists={0}
        diceCount={2} picker="attacker" resolution={resolution}
        onAccept={vi.fn()} onReject={vi.fn()}
      />,
    );
    expect(screen.getByText('ST 3 + 1 assist = 4')).toBeTruthy();
    expect(screen.getByText('2 dice, downhill')).toBeTruthy();
  });

  it('lists every die face that leads to turnover', () => {
    render(
      <BlockSplitPanel
        attackerName="Aldric" defenderName="Grukk"
        attackerStrength={3} attackerAssists={0}
        defenderStrength={3} defenderAssists={0}
        diceCount={1} picker="attacker" resolution={blockBoardStates([], [])}
        onAccept={vi.fn()} onReject={vi.fn()}
      />,
    );

    expect(screen.getByText('Attacker Down, Both Down')).toBeTruthy();
  });
});
