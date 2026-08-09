import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameState } from './useGameState';
import { makeState, humanThrower } from './test/gameState';
import { compactDisplayLog, rollCount } from './actionLogDisplay';

/**
 * The action log's "Cumulative" figure, the HUD percentage, and the score
 * that gets submitted must all be the same number.
 *
 * They were not. Both display sites multiplied the last entry's
 * cumulativeProb by state.pendingProb, but pendingProb resets on each
 * activation and accumulates the same per-step values — it is always a subset
 * of what cumulativeProb already holds. The current piece's rolls were
 * counted twice, so the interface under-reported the player's own line while
 * the leaderboard recorded the correct one.
 */
describe('committed probability is reported once', () => {
  /** Walk the thrower eight squares: six on MA, then two Go For It rushes. */
  function walkIntoTheGfiRing() {
    const state = makeState([humanThrower({ position: { col: 7, row: 2 } })]);
    const { result } = renderHook(() => useGameState(state));
    act(() => result.current.handleSquareClick(7, 2));
    act(() => result.current.handleSquareHover(7, 10));
    act(() => result.current.handleSquareClick(7, 10));
    return result.current.state;
  }

  it('accumulates exactly one factor per roll', () => {
    const state = walkIntoTheGfiRing();
    const last = state.actionLog[state.actionLog.length - 1];

    // Eight steps, of which the last two are rushes at 5/6 each.
    expect(rollCount(state.actionLog)).toBe(2);
    expect(last.cumulativeProb).toBeCloseTo((5 / 6) ** 2, 10);
  });

  it('does not multiply pendingProb back in', () => {
    const state = walkIntoTheGfiRing();
    const last = state.actionLog[state.actionLog.length - 1];

    // pendingProb holds the same rolls for the piece still activated, so the
    // old `cumulativeProb * pendingProb` squared them: 0.482 instead of 0.694.
    expect(state.pendingProb).toBeCloseTo(last.cumulativeProb, 10);
    expect(last.cumulativeProb * state.pendingProb).toBeCloseTo((5 / 6) ** 4, 10);
    expect(last.cumulativeProb).not.toBeCloseTo((5 / 6) ** 4, 4);
  });

  it('shows every roll it counted', () => {
    const state = walkIntoTheGfiRing();
    const displayed = compactDisplayLog(state.actionLog);
    const shownRolls = displayed.filter(e => e.kind === 'move' && e.isGfi).length;

    // The compaction used to fold the two rushes together, so the log listed
    // one roll while the cumulative counted two.
    expect(shownRolls).toBe(rollCount(state.actionLog));
  });
});
