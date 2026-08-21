import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameState } from './useGameState';
import { makeState, humanBlocker as blocker, orcBlocker as orc, humanThrower as thrower } from './test/gameState';

/**
 * Cancelling an activation must rewind the board, not just the action log.
 *
 * Several sub-steps (Blitz movement, loose-ball pickup) commit to `pieces` and
 * `ballPosition` before the activation finishes. Truncating only the log
 * refunded the probability cost of getting there while leaving the piece at its
 * new square and still unactivated — a free-movement exploit against the score,
 * which is the cumulative probability.
 */
describe('cancelling an activation rewinds the board', () => {
  it('a cancelled Blitz gives back neither the movement nor the free reselect', () => {
    const state = makeState([
      blocker({ position: { col: 7, row: 12 } }),
      orc({ position: { col: 7, row: 9 } }),
    ]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleBlockAction('human1', true));
    act(() => result.current.handleBlockTarget(7, 9));   // choose the defender
    act(() => result.current.handleSquareClick(7, 10));  // move into contact
    act(() => result.current.handleBlockTarget(7, 9));   // throw the block

    expect(result.current.state.blockChoice).not.toBeNull();
    expect(result.current.state.pieces.find(p => p.id === 'human1')!.position)
      .toEqual({ col: 7, row: 10 });

    // Back out of the outcome panel.
    act(() => result.current.handleCancelSelection());

    const after = result.current.state;
    const attacker = after.pieces.find(p => p.id === 'human1')!;
    expect(attacker.position).toEqual({ col: 7, row: 12 });
    expect(attacker.activated).toBe(false);
    expect(after.actionLog).toHaveLength(0);
    expect(after.pendingProb).toBe(1);
    expect(after.blitzUsed).toBe(false);
    expect(after.selectedPieceId).toBeNull();
  });

  it('a cancelled move does not consume a loose ball', () => {
    const state = makeState(
      [thrower({ hasBall: false, position: { col: 7, row: 12 } })],
      'human',
      { col: 7, row: 10 },
    );
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleSquareClick(7, 12)); // select
    act(() => result.current.handleSquareClick(7, 10)); // walk onto the ball
    act(() => result.current.handleCancelSelection());

    const after = result.current.state;
    const piece = after.pieces.find(p => p.id === 'thrower')!;
    expect(piece.position).toEqual({ col: 7, row: 12 });
    expect(piece.hasBall).toBe(false);
    expect(piece.activated).toBe(false);
    expect(after.ballPosition).toEqual({ col: 7, row: 10 });
    expect(after.actionLog).toHaveLength(0);
  });

  it('Plot Again rewinds movement while keeping the same player active', () => {
    const state = makeState([
      thrower({ position: { col: 7, row: 12 } }),
    ]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleSquareClick(7, 12));
    act(() => result.current.handleSquareClick(7, 10));
    expect(result.current.state.committedPath).not.toHaveLength(0);
    expect(result.current.state.remainingMa).toBeLessThan(6);

    act(() => result.current.handleResetMovement());

    expect(result.current.state.selectedPieceId).toBe('thrower');
    expect(result.current.state.committedPath).toEqual([]);
    expect(result.current.state.walkedSquares).toEqual([]);
    expect(result.current.state.remainingMa).toBe(6);
    expect(result.current.state.pieces.find(piece => piece.id === 'thrower')?.activated).toBe(false);
  });

  it('cancelling a declared Pass before targeting rewinds the movement', () => {
    const state = makeState([
      thrower({ position: { col: 7, row: 12 } }),
      blocker({ id: 'mate', position: { col: 3, row: 3 } }),
    ]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handlePassAction('thrower'));
    act(() => result.current.handleSquareClick(7, 10)); // move first
    expect(result.current.state.actionLog.length).toBeGreaterThan(0);

    act(() => result.current.handleCancelSelection());

    const after = result.current.state;
    expect(after.pieces.find(p => p.id === 'thrower')!.position).toEqual({ col: 7, row: 12 });
    expect(after.actionLog).toHaveLength(0);
    expect(after.passUsed).toBe(false);
  });

  it('deselecting a zero-square Move + Pass leaves the carrier available to play again', () => {
    const state = makeState([
      thrower({ position: { col: 7, row: 12 } }),
      blocker({ id: 'mate', position: { col: 7, row: 9 } }),
    ]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handlePassAction('thrower'));
    expect(result.current.state.pendingPass).toBe(true);
    expect(result.current.state.selectedPieceId).toBe('thrower');

    // App maps a second tap on the unmoved selected player to cancellation,
    // rather than the end-activation click used to enter receiver targeting.
    act(() => result.current.handleCancelSelection());

    const deselected = result.current.state;
    expect(deselected.selectedPieceId).toBeNull();
    expect(deselected.pendingPass).toBe(false);
    expect(deselected.pieces.find(piece => piece.id === 'thrower')!.activated).toBe(false);

    act(() => result.current.handlePassAction('thrower'));
    expect(result.current.state.selectedPieceId).toBe('thrower');
    expect(result.current.state.pendingPass).toBe(true);
  });

  it('a resolved block survives a later cancel of the leftover Blitz movement', () => {
    const state = makeState([
      blocker({ position: { col: 7, row: 10 } }),
      orc({ position: { col: 7, row: 9 } }),
    ]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleBlockAction('human1', true));
    act(() => result.current.handleBlockTarget(7, 9)); // choose target (already adjacent)
    act(() => result.current.handleBlockTarget(7, 9)); // block
    act(() => result.current.handleBlockOutcomeChoice(['push'], 'push'));
    act(() => result.current.handlePushChoice(7, 8, false));

    const blockEntries = result.current.state.actionLog.filter(e => e.kind === 'block');
    expect(blockEntries).toHaveLength(1);

    // Cancel the remaining movement — the block is already resolved and paid
    // for, so it must stay on the log.
    act(() => result.current.handleCancelSelection());

    expect(result.current.state.actionLog.filter(e => e.kind === 'block')).toHaveLength(1);
    expect(result.current.state.blitzUsed).toBe(true);
    expect(result.current.state.pieces.find(p => p.id === 'orc1')!.position).toEqual({ col: 7, row: 8 });
  });

  it('reselecting a piece paused mid-post-Blitz leftover movement resumes with its leftover MA, not a fresh full pool (#191)', () => {
    const state = makeState([
      blocker({ position: { col: 7, row: 10 } }), // MA 6
      orc({ position: { col: 7, row: 9 } }),
    ]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleBlockAction('human1', true));
    act(() => result.current.handleBlockTarget(7, 9)); // choose target (already adjacent)
    act(() => result.current.handleBlockTarget(7, 9)); // throw the block
    act(() => result.current.handleBlockOutcomeChoice(['push'], 'push'));
    act(() => result.current.handlePushChoice(7, 8, false));

    expect(result.current.state.remainingMa).toBe(5);

    // Click off the piece without following up (deselect), as the bug report
    // describes, then click back on it.
    act(() => result.current.handleSquareClick(0, 0));
    expect(result.current.state.selectedPieceId).toBeNull();
    expect(result.current.state.pieces.find(p => p.id === 'human1')!.activated).toBe(false);

    act(() => result.current.handleSquareClick(7, 10));

    expect(result.current.state.selectedPieceId).toBe('human1');
    expect(result.current.state.remainingMa).toBe(5);
  });
});

/**
 * BB2020: a player knocked down loses the ball. Without this, blocking the
 * opposing ball carrier — a core tactic — had no effect on the ball at all.
 */
describe('a knocked-down carrier drops the ball', () => {
  it('drops it on Defender Down, on the square the defender is pushed to', () => {
    const state = makeState([
      blocker({ position: { col: 7, row: 10 } }),
      orc({ position: { col: 7, row: 9 }, hasBall: true }),
    ]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleBlockAction('human1', false));
    act(() => result.current.handleBlockTarget(7, 9));
    act(() => result.current.handleBlockOutcomeChoice(['defender-down'], 'defender-down'));
    act(() => result.current.handlePushChoice(7, 8, false));

    const after = result.current.state;
    const defender = after.pieces.find(p => p.id === 'orc1')!;
    expect(defender.down).toBe(true);
    expect(defender.hasBall).toBe(false);
    expect(after.ballPosition).toEqual({ col: 7, row: 8 });
  });

  it('keeps the ball on a plain Push, which does not knock the defender down', () => {
    const state = makeState([
      blocker({ position: { col: 7, row: 10 } }),
      orc({ position: { col: 7, row: 9 }, hasBall: true }),
    ]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleBlockAction('human1', false));
    act(() => result.current.handleBlockTarget(7, 9));
    act(() => result.current.handleBlockOutcomeChoice(['push'], 'push'));
    act(() => result.current.handlePushChoice(7, 8, false));

    const after = result.current.state;
    const defender = after.pieces.find(p => p.id === 'orc1')!;
    expect(defender.down).toBe(false);
    expect(defender.hasBall).toBe(true);
    expect(after.ballPosition).toBeNull();
  });

  it('drops it when the attacker goes down carrying it', () => {
    const state = makeState([
      blocker({ position: { col: 7, row: 10 }, hasBall: true }),
      orc({ position: { col: 7, row: 9 } }),
    ]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleBlockAction('human1', false));
    act(() => result.current.handleBlockTarget(7, 9));
    act(() => result.current.handleBlockOutcomeChoice(['attacker-down'], 'attacker-down'));

    const after = result.current.state;
    const attacker = after.pieces.find(p => p.id === 'human1')!;
    expect(attacker.down).toBe(true);
    expect(attacker.hasBall).toBe(false);
    expect(after.ballPosition).toEqual({ col: 7, row: 10 });
  });

  it('drops it on Both Down when the carrier has no Block skill', () => {
    const state = makeState([
      blocker({ position: { col: 7, row: 10 } }),
      orc({ position: { col: 7, row: 9 }, hasBall: true }),
    ]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleBlockAction('human1', false));
    act(() => result.current.handleBlockTarget(7, 9));
    act(() => result.current.handleBlockOutcomeChoice(['both-down'], 'both-down'));

    const after = result.current.state;
    expect(after.pieces.find(p => p.id === 'orc1')!.hasBall).toBe(false);
    expect(after.ballPosition).toEqual({ col: 7, row: 9 });
  });

  it('leaves the ball with a carrier whose Block skill keeps them standing', () => {
    const state = makeState([
      blocker({ position: { col: 7, row: 10 }, skills: ['Block'] }),
      orc({ position: { col: 7, row: 9 }, hasBall: true, skills: ['Block'] }),
    ]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleBlockAction('human1', false));
    act(() => result.current.handleBlockTarget(7, 9));
    act(() => result.current.handleBlockOutcomeChoice(['both-down'], 'both-down'));

    const after = result.current.state;
    const defender = after.pieces.find(p => p.id === 'orc1')!;
    expect(defender.down).toBe(false);
    expect(defender.hasBall).toBe(true);
    expect(after.ballPosition).toBeNull();
  });
});

/** BB2020: the block itself costs one square of the Blitz's movement. */
describe('a Blitz block costs a square of movement', () => {
  it('charges MA for the block, so a blitzer does not get MA + 1', () => {
    const state = makeState([
      blocker({ position: { col: 7, row: 10 } }), // MA 6
      orc({ position: { col: 7, row: 9 } }),
    ]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleBlockAction('human1', true));
    act(() => result.current.handleBlockTarget(7, 9)); // choose target, no movement yet
    expect(result.current.state.remainingMa).toBe(6);

    act(() => result.current.handleBlockTarget(7, 9)); // throw the block
    expect(result.current.state.remainingMa).toBe(5);
  });
});
