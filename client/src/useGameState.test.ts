import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameState } from './useGameState';
import type { GameState, PlayerPiece } from './types';

/**
 * Regression tests for the "long bomb" pass/handoff bug: a receiver who
 * already completed their own activation earlier in the turn was wrongly
 * excluded as a pass/handoff target, leaving the carrier's activation
 * stuck (never marked `activated`) and reselectable for a free extra move.
 */

function makeState(
  pieces: PlayerPiece[],
  activeTeam: GameState['activeTeam'] = 'human',
  ballPosition: GameState['ballPosition'] = null,
): GameState {
  return {
    pieces,
    activeTeam,
    selectedPieceId: null,
    reachableKeys: new Set(),
    originPos: null,
    committedPath: [],
    walkedSquares: [],
    pathPreview: [],
    remainingMa: 0,
    remainingGfi: 0,
    pendingDodgeTargets: [],
    humanTurn: 1,
    orcTurn: 1,
    half: 1,
    score: { human: 0, orc: 0 },
    phase: 'playing',
    activationLogStart: 0,
    pendingProb: 1,
    actionLog: [],
    isPuzzleMode: false,
    scenarioId: null,
    ballPosition,
    passUsed: false,
    pendingHandoff: false,
    isHandoffTargeting: false,
    handoffTargets: new Set(),
    pendingPass: false,
    isPassTargeting: false,
    passRangeKeys: new Map(),
    passReceiverKeys: new Set(),
  };
}

function thrower(overrides: Partial<PlayerPiece> = {}): PlayerPiece {
  return {
    id: 'thrower',
    team: 'human',
    role: 'thrower',
    name: 'Aldric Swiftfoot',
    position: { col: 7, row: 10 },
    ma: 6, st: 3, ag: 3, pa: 3, av: 8,
    skills: [],
    activated: false,
    hasBall: true,
    ...overrides,
  };
}

function catcher(overrides: Partial<PlayerPiece> = {}): PlayerPiece {
  return {
    id: 'catcher',
    team: 'human',
    role: 'catcher',
    name: 'Sera Quickhand',
    // dx=0, dy=2 from the thrower's default position → "quick" range band
    position: { col: 7, row: 8 },
    ma: 8, st: 2, ag: 4, pa: 5, av: 7,
    skills: ['Catch', 'Dodge'],
    activated: false,
    hasBall: false,
    ...overrides,
  };
}

describe('pass to an already-activated receiver', () => {
  it('(a) includes an already-activated teammate in passReceiverKeys', () => {
    const state = makeState([thrower(), catcher({ activated: true })]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handlePassAction('thrower'));
    // Skip movement — click the carrier's own square to end movement and open pass targeting.
    act(() => result.current.handleSquareClick(7, 10));

    expect(result.current.state.isPassTargeting).toBe(true);
    expect(result.current.state.passReceiverKeys.has('7,8')).toBe(true);
  });

  it('(b) completes the pass, activates the carrier, and blocks reselection', () => {
    const state = makeState([thrower(), catcher({ activated: true })]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handlePassAction('thrower'));
    act(() => result.current.handleSquareClick(7, 10));
    act(() => result.current.handlePassTarget(7, 8));

    const { state: after } = result.current;
    const throwerPiece = after.pieces.find(p => p.id === 'thrower')!;
    const catcherPiece = after.pieces.find(p => p.id === 'catcher')!;

    expect(catcherPiece.hasBall).toBe(true);
    expect(throwerPiece.hasBall).toBe(false);
    expect(throwerPiece.activated).toBe(true);
    expect(after.passUsed).toBe(true);
    // Catching a pass must not itself flip the receiver's activated flag —
    // it was already true before the play and must stay true, not be reset.
    expect(catcherPiece.activated).toBe(true);

    // The thrower must not be reselectable/movable again this turn.
    act(() => result.current.handleSquareClick(7, 8));
    expect(result.current.state.selectedPieceId).toBeNull();
  });
});

describe('handoff to an already-activated receiver', () => {
  it('(d) includes and successfully hands off to an already-activated adjacent teammate', () => {
    const state = makeState([
      thrower({ position: { col: 7, row: 9 } }),
      catcher({ position: { col: 7, row: 8 }, activated: true }),
    ]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleHandoffAction('thrower'));
    act(() => result.current.handleSquareClick(7, 9));

    expect(result.current.state.isHandoffTargeting).toBe(true);
    expect(result.current.state.handoffTargets.has('7,8')).toBe(true);

    act(() => result.current.handleHandoffTarget(7, 8));

    const { state: after } = result.current;
    const throwerPiece = after.pieces.find(p => p.id === 'thrower')!;
    const catcherPiece = after.pieces.find(p => p.id === 'catcher')!;

    expect(catcherPiece.hasBall).toBe(true);
    expect(throwerPiece.hasBall).toBe(false);
    expect(throwerPiece.activated).toBe(true);
    expect(after.passUsed).toBe(true);
    expect(catcherPiece.activated).toBe(true);

    act(() => result.current.handleSquareClick(7, 8));
    expect(result.current.state.selectedPieceId).toBeNull();
  });
});

describe('receiving a pass/handoff in the end zone scores a touchdown', () => {
  it('(e) pass: catching the ball in the end zone sets phase to touchdown', () => {
    const state = makeState([
      thrower(),
      // Human end zone is row 0; dx=0/dy=10 from the thrower is in "long" pass range.
      catcher({ position: { col: 7, row: 0 } }),
    ]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handlePassAction('thrower'));
    act(() => result.current.handleSquareClick(7, 10));
    expect(result.current.state.passReceiverKeys.has('7,0')).toBe(true);

    act(() => result.current.handlePassTarget(7, 0));

    const { state: after } = result.current;
    const catcherPiece = after.pieces.find(p => p.id === 'catcher')!;
    expect(catcherPiece.hasBall).toBe(true);
    expect(after.phase).toBe('touchdown');
  });

  it('(f) handoff: receiving the ball in the end zone sets phase to touchdown', () => {
    const state = makeState([
      thrower({ position: { col: 7, row: 1 } }),
      // Adjacent to the carrier and standing in the human end zone (row 0).
      catcher({ position: { col: 7, row: 0 } }),
    ]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleHandoffAction('thrower'));
    act(() => result.current.handleSquareClick(7, 1));
    expect(result.current.state.handoffTargets.has('7,0')).toBe(true);

    act(() => result.current.handleHandoffTarget(7, 0));

    const { state: after } = result.current;
    const catcherPiece = after.pieces.find(p => p.id === 'catcher')!;
    expect(catcherPiece.hasBall).toBe(true);
    expect(after.phase).toBe('touchdown');
  });

  it('(g) pass: a completed pass that stays in play does not change phase', () => {
    const state = makeState([thrower(), catcher()]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handlePassAction('thrower'));
    act(() => result.current.handleSquareClick(7, 10));
    act(() => result.current.handlePassTarget(7, 8));

    expect(result.current.state.phase).toBe('playing');
  });
});

describe('loose ball pickup', () => {
  it('moving onto the loose ball square sets hasBall and clears the loose ball at end of activation', () => {
    // Thrower (no ball) starts two squares from the loose ball, no opponents nearby
    // so no dodge is required — only the pickup Agility test applies.
    const state = makeState(
      [thrower({ hasBall: false, position: { col: 7, row: 12 } })],
      'human',
      { col: 7, row: 10 },
    );
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleSquareClick(7, 12)); // select
    act(() => result.current.handleSquareClick(7, 10)); // move onto the loose ball
    act(() => result.current.handleSquareClick(7, 10)); // end activation (click path tip)

    const { state: after } = result.current;
    const piece = after.pieces.find(p => p.id === 'thrower')!;

    expect(piece.hasBall).toBe(true);
    expect(piece.position).toEqual({ col: 7, row: 10 });
    expect(after.ballPosition).toBeNull();

    // The step landing on the ball square logged a pickup target and folded
    // its probability into the cumulative probability.
    const pickupEntry = after.actionLog.find(e => e.kind === 'move' && e.to.col === 7 && e.to.row === 10);
    expect(pickupEntry).toBeDefined();
    expect(pickupEntry!.kind === 'move' && pickupEntry!.pickupTarget).toBe(3); // AG3 → 6-3=3+, no TZ
    const expectedProb = 4 / 6; // successChance(3)
    expect(pickupEntry!.actionProb).toBeCloseTo(expectedProb, 5);
    expect(after.actionLog[after.actionLog.length - 1].cumulativeProb).toBeCloseTo(expectedProb, 5);
  });

  it('picking up the ball and reaching the end zone in the same click triggers touchdown', () => {
    // Ball sits between the thrower and the end zone (row 0) — a single click
    // to row 0 walks across the ball's square first.
    const state = makeState(
      [thrower({ hasBall: false, position: { col: 7, row: 3 } })],
      'human',
      { col: 7, row: 2 },
    );
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleSquareClick(7, 3));  // select
    act(() => result.current.handleSquareClick(7, 0));  // move straight through the ball to the end zone

    const { state: after } = result.current;
    const piece = after.pieces.find(p => p.id === 'thrower')!;

    expect(after.phase).toBe('touchdown');
    expect(piece.hasBall).toBe(true);
    expect(piece.position).toEqual({ col: 7, row: 0 });
    expect(after.ballPosition).toBeNull();
  });

  it('a step requiring both a dodge and a pickup multiplies both probabilities', () => {
    // Two orcs flank the loose ball's square so leaving the thrower's
    // starting tackle zone AND picking up the ball both apply a +1 TZ
    // modifier — both rolls become 4+ and their probabilities multiply.
    const state = makeState(
      [
        thrower({ hasBall: false, position: { col: 7, row: 10 } }),
        { id: 'opp1', team: 'orc', role: 'blocker', name: 'Grukk', position: { col: 7, row: 11 }, ma: 4, st: 3, ag: 3, pa: 6, av: 9, skills: [], activated: false, hasBall: false },
        { id: 'opp2', team: 'orc', role: 'blocker', name: 'Muzgash', position: { col: 8, row: 9 }, ma: 4, st: 3, ag: 3, pa: 6, av: 9, skills: [], activated: false, hasBall: false },
      ],
      'human',
      { col: 7, row: 9 },
    );
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleSquareClick(7, 10)); // select (starts in opp1's TZ)
    act(() => result.current.handleSquareClick(7, 9));  // step onto the loose ball, leaving the TZ

    const { state: after } = result.current;
    const stepEntry = after.actionLog.find(e => e.kind === 'move' && e.to.col === 7 && e.to.row === 9);
    expect(stepEntry).toBeDefined();
    expect(stepEntry!.kind === 'move' && stepEntry!.dodgeTarget).toBe(4);  // 6-3+1 (opp2 covers 7,9)
    expect(stepEntry!.kind === 'move' && stepEntry!.pickupTarget).toBe(4); // same TZ modifier
    const expectedProb = (3 / 6) * (3 / 6); // successChance(4) * successChance(4)
    expect(stepEntry!.actionProb).toBeCloseTo(expectedProb, 5);
  });

  it('the loose ball persists across turns until picked up', () => {
    const state = makeState(
      [thrower({ hasBall: false, position: { col: 7, row: 12 } })],
      'human',
      { col: 3, row: 3 },
    );
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleSquareClick(7, 12)); // select, no movement
    act(() => result.current.handleEndTurn());

    expect(result.current.state.ballPosition).toEqual({ col: 3, row: 3 });
  });

  it('handleHandoffAction is allowed for a piece without the ball when the ball is loose', () => {
    const state = makeState(
      [thrower({ hasBall: false, position: { col: 7, row: 12 } }), catcher({ position: { col: 7, row: 9 } })],
      'human',
      { col: 7, row: 10 },
    );
    const { result } = renderHook(() => useGameState(state));

    // Declaring handoff on a piece with no ball is only legal because a loose ball exists.
    act(() => result.current.handleHandoffAction('thrower'));
    expect(result.current.state.selectedPieceId).toBe('thrower');
    expect(result.current.state.pendingHandoff).toBe(true);
  });

  it('picking up the loose ball then hand-off transfers it to the receiver', () => {
    const state = makeState(
      [
        thrower({ hasBall: false, position: { col: 7, row: 12 } }),
        catcher({ position: { col: 7, row: 9 } }),
      ],
      'human',
      { col: 7, row: 10 },
    );
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleHandoffAction('thrower'));
    act(() => result.current.handleSquareClick(7, 10)); // move onto the loose ball
    act(() => result.current.handleSquareClick(7, 10)); // end movement (click path tip) — opens handoff targeting

    // Ball should be picked up immediately so handoff targeting can find the carrier.
    expect(result.current.state.isHandoffTargeting).toBe(true);
    expect(result.current.state.handoffTargets.has('7,9')).toBe(true);
    const midState = result.current.state;
    const throwerMid = midState.pieces.find(p => p.id === 'thrower')!;
    expect(throwerMid.hasBall).toBe(true);
    expect(midState.ballPosition).toBeNull();

    act(() => result.current.handleHandoffTarget(7, 9));

    const { state: after } = result.current;
    const throwerPiece = after.pieces.find(p => p.id === 'thrower')!;
    const catcherPiece = after.pieces.find(p => p.id === 'catcher')!;
    expect(throwerPiece.hasBall).toBe(false);
    expect(catcherPiece.hasBall).toBe(true);
    expect(after.passUsed).toBe(true);
  });

  it('declaring hand-off but never reaching the loose ball ends the activation without a handoff', () => {
    const state = makeState(
      [
        thrower({ hasBall: false, position: { col: 7, row: 12 } }),
        catcher({ position: { col: 7, row: 13 } }),
      ],
      'human',
      { col: 3, row: 3 },
    );
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleHandoffAction('thrower'));
    // End movement immediately without ever reaching the loose ball's square.
    act(() => result.current.handleSquareClick(7, 12));

    const { state: after } = result.current;
    expect(after.isHandoffTargeting).toBe(false);
    expect(after.pendingHandoff).toBe(false);
    expect(after.passUsed).toBe(false);
    expect(after.ballPosition).toEqual({ col: 3, row: 3 });
    const throwerPiece = after.pieces.find(p => p.id === 'thrower')!;
    expect(throwerPiece.hasBall).toBe(false);
    expect(throwerPiece.activated).toBe(true);
  });
});

describe('zero valid targets auto-activates the carrier', () => {
  it('(c) pass: carrier with no teammates ends its activation instead of hanging in targeting mode', () => {
    const state = makeState([thrower()]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handlePassAction('thrower'));
    act(() => result.current.handleSquareClick(7, 10));

    const { state: after } = result.current;
    const throwerPiece = after.pieces.find(p => p.id === 'thrower')!;

    expect(after.isPassTargeting).toBe(false);
    expect(after.pendingPass).toBe(false);
    expect(after.passReceiverKeys.size).toBe(0);
    expect(throwerPiece.activated).toBe(true);
    expect(after.passUsed).toBe(false);

    // Cannot reselect the carrier this turn.
    act(() => result.current.handleSquareClick(7, 10));
    expect(result.current.state.selectedPieceId).toBeNull();
  });

  it('(c) handoff: carrier with no adjacent teammates ends its activation instead of hanging in targeting mode', () => {
    const state = makeState([thrower()]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleHandoffAction('thrower'));
    act(() => result.current.handleSquareClick(7, 10));

    const { state: after } = result.current;
    const throwerPiece = after.pieces.find(p => p.id === 'thrower')!;

    expect(after.isHandoffTargeting).toBe(false);
    expect(after.pendingHandoff).toBe(false);
    expect(after.handoffTargets.size).toBe(0);
    expect(throwerPiece.activated).toBe(true);
    expect(after.passUsed).toBe(false);

    act(() => result.current.handleSquareClick(7, 10));
    expect(result.current.state.selectedPieceId).toBeNull();
  });
});
