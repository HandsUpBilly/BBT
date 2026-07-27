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

function makeState(pieces: PlayerPiece[], activeTeam: GameState['activeTeam'] = 'human'): GameState {
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
