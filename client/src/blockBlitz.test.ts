import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameState } from './useGameState';
import type { GameState, PlayerPiece } from './types';
import { blockOutcomeProbabilities, blockCombinedProbability } from './bfs';
import { blockActionAvailability } from './blockActionAvailability';

function makeState(
  pieces: PlayerPiece[],
  activeTeam: GameState['activeTeam'] = 'human',
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
    ballPosition: null,
    passUsed: false,
    pendingHandoff: false,
    isHandoffTargeting: false,
    handoffTargets: new Set(),
    pendingPass: false,
    isPassTargeting: false,
    passRangeKeys: new Map(),
    passReceiverKeys: new Set(),
    blitzUsed: false,
    pendingBlock: false,
    pendingBlockIsBlitz: false,
    blitzTargetId: null,
    isBlockTargeting: false,
    blockTargets: new Set(),
    blockChoice: null,
    pushTargetKeys: new Set(),
    pendingBlockResolution: null,
  };
}

function blocker(overrides: Partial<PlayerPiece> = {}): PlayerPiece {
  return {
    id: 'human1',
    team: 'human',
    role: 'blocker',
    name: 'Aldric Swiftfoot',
    position: { col: 7, row: 10 },
    ma: 6, st: 3, ag: 3, pa: 3, av: 8,
    skills: [],
    activated: false,
    hasBall: false,
    down: false,
    ...overrides,
  };
}

function orc(overrides: Partial<PlayerPiece> = {}): PlayerPiece {
  return {
    id: 'orc1',
    team: 'orc',
    role: 'blocker',
    name: 'Grukk Ironjaw',
    position: { col: 7, row: 9 },
    ma: 4, st: 3, ag: 3, pa: 6, av: 9,
    skills: [],
    activated: false,
    hasBall: false,
    down: false,
    ...overrides,
  };
}

describe('Block and Blitz menu availability', () => {
  it('allows Blitz before the attacker is adjacent to an opponent', () => {
    const attacker = blocker({ position: { col: 7, row: 12 } });
    const pieces = [attacker, orc({ position: { col: 7, row: 9 } })];

    expect(blockActionAvailability(attacker, pieces, false)).toEqual({
      canBlock: false,
      canBlitz: true,
    });
  });

  it('disables Blitz when there is no standing opponent to target', () => {
    const attacker = blocker({ position: { col: 7, row: 12 } });
    const downedOpponent = orc({ position: { col: 7, row: 9 }, down: true });

    expect(blockActionAvailability(attacker, [attacker, downedOpponent], false)).toEqual({
      canBlock: false,
      canBlitz: false,
    });
  });

  it('disables Blitz when the only standing opponent is out of movement range', () => {
    const attacker = blocker({ position: { col: 7, row: 20 }, ma: 6 });
    const farOpponent = orc({ position: { col: 7, row: 0 } });

    expect(blockActionAvailability(attacker, [attacker, farOpponent], false)).toEqual({
      canBlock: false,
      canBlitz: false,
    });
  });

  it('allows Block when a standing opponent is adjacent', () => {
    const attacker = blocker();

    expect(blockActionAvailability(attacker, [attacker, orc()], false)).toEqual({
      canBlock: true,
      canBlitz: true,
    });
  });

  it('disables Blitz after it is spent and disables both actions for an activated player', () => {
    const attacker = blocker();
    const pieces = [attacker, orc()];

    expect(blockActionAvailability(attacker, pieces, true)).toEqual({
      canBlock: true,
      canBlitz: false,
    });
    expect(blockActionAvailability({ ...attacker, activated: true }, pieces, false)).toEqual({
      canBlock: false,
      canBlitz: false,
    });
  });
});

describe('plain Block (no movement)', () => {
  it('opens defender targeting directly from the current square', () => {
    const state = makeState([blocker(), orc()]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleBlockAction('human1', false));

    expect(result.current.state.isBlockTargeting).toBe(true);
    expect(result.current.state.selectedPieceId).toBe('human1');
    expect(result.current.state.blockTargets.has('7,9')).toBe(true);
    // Attacker never moved.
    expect(result.current.state.pieces.find(p => p.id === 'human1')!.position).toEqual({ col: 7, row: 10 });
  });

  it('ends the activation with no block thrown when there is no adjacent opponent', () => {
    const state = makeState([blocker(), orc({ position: { col: 0, row: 0 } })]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleBlockAction('human1', false));

    expect(result.current.state.isBlockTargeting).toBe(false);
    expect(result.current.state.selectedPieceId).toBeNull();
    // handleBlockAction bails out before touching pieces when there's no target.
    expect(result.current.state.pieces.find(p => p.id === 'human1')!.activated).toBe(false);
  });

  it('computes 1 die / attacker-picks for equal effective Strength, with no assists', () => {
    const state = makeState([blocker(), orc()]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleBlockAction('human1', false));
    act(() => result.current.handleBlockTarget(7, 9));

    const { blockChoice } = result.current.state;
    expect(blockChoice).not.toBeNull();
    expect(blockChoice!.diceCount).toBe(1);
    expect(blockChoice!.picker).toBe('attacker');
    expect(blockChoice!.outcomeProbs).toEqual(blockOutcomeProbabilities(1, 'attacker'));
  });

  it('counts adjacent assists on both sides toward dice count', () => {
    // Attacker gets 1 assist (human2 adjacent to orc1) -> effective ST 4 vs 3 -> 2 dice, attacker picks.
    const state = makeState([
      blocker(),
      orc(),
      blocker({ id: 'human2', name: 'Sera Quickhand', position: { col: 8, row: 9 } }),
    ]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleBlockAction('human1', false));
    act(() => result.current.handleBlockTarget(7, 9));

    const { blockChoice } = result.current.state;
    expect(blockChoice!.diceCount).toBe(2);
    expect(blockChoice!.picker).toBe('attacker');
  });

  it('an assisting teammate who is down does not count', () => {
    const state = makeState([
      blocker(),
      orc(),
      blocker({ id: 'human2', name: 'Sera Quickhand', position: { col: 8, row: 9 }, down: true }),
    ]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleBlockAction('human1', false));
    act(() => result.current.handleBlockTarget(7, 9));

    expect(result.current.state.blockChoice!.diceCount).toBe(1);
  });
});

describe('Block outcome resolution', () => {
  it('attacker-down: knocks the attacker down and ends its activation', () => {
    const state = makeState([blocker(), orc()]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleBlockAction('human1', false));
    act(() => result.current.handleBlockTarget(7, 9));
    act(() => result.current.handleBlockOutcomeChoice(['attacker-down'], 'attacker-down'));

    const { state: after } = result.current;
    const attacker = after.pieces.find(p => p.id === 'human1')!;
    const defender = after.pieces.find(p => p.id === 'orc1')!;
    expect(attacker.down).toBe(true);
    expect(attacker.activated).toBe(true);
    expect(defender.down).toBe(false);
    expect(after.blockChoice).toBeNull();
    expect(after.selectedPieceId).toBeNull();

    const entry = after.actionLog[after.actionLog.length - 1];
    expect(entry.kind).toBe('block');
    if (entry.kind === 'block') {
      expect(entry.resolvedFace).toBe('attacker-down');
      expect(entry.acceptedFaces).toEqual(['attacker-down']);
    }
  });

  it('both-down: knocks both down when neither has Block skill', () => {
    const state = makeState([blocker(), orc()]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleBlockAction('human1', false));
    act(() => result.current.handleBlockTarget(7, 9));
    act(() => result.current.handleBlockOutcomeChoice(['both-down'], 'both-down'));

    const { state: after } = result.current;
    expect(after.pieces.find(p => p.id === 'human1')!.down).toBe(true);
    expect(after.pieces.find(p => p.id === 'orc1')!.down).toBe(true);
  });

  it('both-down: a piece with the Block skill stays standing', () => {
    const state = makeState([blocker({ skills: ['Block'] }), orc()]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleBlockAction('human1', false));
    act(() => result.current.handleBlockTarget(7, 9));
    act(() => result.current.handleBlockOutcomeChoice(['both-down'], 'both-down'));

    const { state: after } = result.current;
    expect(after.pieces.find(p => p.id === 'human1')!.down).toBe(false);
    expect(after.pieces.find(p => p.id === 'orc1')!.down).toBe(true);
    // Attacker's activation still ends even though it stayed standing.
    expect(after.pieces.find(p => p.id === 'human1')!.activated).toBe(true);
  });

  it('both-down: Wrestle puts both players down when the attacker lacks Block', () => {
    const state = makeState([
      blocker({ skills: ['Wrestle'] }),
      orc({ skills: ['Block'] }),
    ]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleBlockAction('human1', false));
    act(() => result.current.handleBlockTarget(7, 9));
    act(() => result.current.handleBlockOutcomeChoice(['both-down'], 'both-down'));

    expect(result.current.state.pieces.find(p => p.id === 'human1')!.down).toBe(true);
    expect(result.current.state.pieces.find(p => p.id === 'orc1')!.down).toBe(true);
  });

  it('push: opens a push-target square choice without ending the activation yet', () => {
    const state = makeState([blocker(), orc()]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleBlockAction('human1', false));
    act(() => result.current.handleBlockTarget(7, 9));
    act(() => result.current.handleBlockOutcomeChoice(['push'], 'push'));

    const { state: after } = result.current;
    expect(after.pendingBlockResolution).not.toBeNull();
    expect(after.pendingBlockResolution!.resolvedFace).toBe('push');
    expect(after.pendingBlockResolution!.defenderFalls).toBe(false);
    expect(after.pendingBlockResolution!.offerFollowUp).toBe(false);
    // Attacker at (7,10), defender at (7,9): push direction is straight back (dy=-1).
    expect(after.pushTargetKeys.has('7,8')).toBe(true);
  });

  it('push: finalizes the defender position and ends the attacker activation on square choice', () => {
    const state = makeState([blocker(), orc()]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleBlockAction('human1', false));
    act(() => result.current.handleBlockTarget(7, 9));
    act(() => result.current.handleBlockOutcomeChoice(['push'], 'push'));
    act(() => result.current.handlePushChoice(7, 8, false));

    const { state: after } = result.current;
    const defender = after.pieces.find(p => p.id === 'orc1')!;
    const attacker = after.pieces.find(p => p.id === 'human1')!;
    expect(defender.position).toEqual({ col: 7, row: 8 });
    expect(defender.down).toBe(false);
    expect(attacker.activated).toBe(true);
    expect(attacker.position).toEqual({ col: 7, row: 10 }); // no follow-up for plain push
    expect(after.pendingBlockResolution).toBeNull();
    expect(after.pushTargetKeys.size).toBe(0);
  });

  it('defender-down: falls, offers a follow-up, and moving in occupies the vacated square', () => {
    const state = makeState([blocker(), orc()]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleBlockAction('human1', false));
    act(() => result.current.handleBlockTarget(7, 9));
    act(() => result.current.handleBlockOutcomeChoice(['defender-down'], 'defender-down'));

    expect(result.current.state.pendingBlockResolution!.offerFollowUp).toBe(true);

    act(() => result.current.handlePushChoice(7, 8, true));

    const { state: after } = result.current;
    const defender = after.pieces.find(p => p.id === 'orc1')!;
    const attacker = after.pieces.find(p => p.id === 'human1')!;
    expect(defender.position).toEqual({ col: 7, row: 8 });
    expect(defender.down).toBe(true);
    expect(attacker.position).toEqual({ col: 7, row: 9 }); // moved into the vacated square
    expect(attacker.activated).toBe(true);
  });

  it('defender-down: declining the follow-up leaves the attacker in place', () => {
    const state = makeState([blocker(), orc()]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleBlockAction('human1', false));
    act(() => result.current.handleBlockTarget(7, 9));
    act(() => result.current.handleBlockOutcomeChoice(['defender-down'], 'defender-down'));
    act(() => result.current.handlePushChoice(7, 8, false));

    const attacker = result.current.state.pieces.find(p => p.id === 'human1')!;
    expect(attacker.position).toEqual({ col: 7, row: 10 });
    expect(attacker.activated).toBe(true);
  });

  it('a down piece cannot be selected, targeted, or activated', () => {
    const state = makeState([blocker(), orc({ down: true })]);
    const { result } = renderHook(() => useGameState(state));

    // No adjacent standing opponent -> Block ends the activation immediately.
    act(() => result.current.handleBlockAction('human1', false));
    expect(result.current.state.isBlockTargeting).toBe(false);
    expect(result.current.state.selectedPieceId).toBeNull();

    // A down piece itself cannot be selected to move/act.
    act(() => result.current.handleSquareClick(7, 9));
    expect(result.current.state.selectedPieceId).toBeNull();
  });
});

describe('Blitz', () => {
  it('chooses a target, moves into contact, blocks, then keeps remaining movement', () => {
    const state = makeState([
      blocker({ position: { col: 7, row: 12 } }),
      orc({ position: { col: 7, row: 9 } }),
    ]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleBlockAction('human1', true));
    expect(result.current.state.pendingBlock).toBe(true);
    expect(result.current.state.pendingBlockIsBlitz).toBe(true);
    expect(result.current.state.isBlockTargeting).toBe(true);
    expect(result.current.state.blockTargets.has('7,9')).toBe(true);
    expect(result.current.state.reachableKeys.size).toBe(0);

    // Choose the defender before movement begins.
    act(() => result.current.handleBlockTarget(7, 9));
    expect(result.current.state.blitzTargetId).toBe('orc1');
    expect(result.current.state.isBlockTargeting).toBe(false);
    expect(result.current.state.reachableKeys.size).toBeGreaterThan(0);

    // Move adjacent, then click the chosen target to throw the block.
    act(() => result.current.handleSquareClick(7, 10));
    act(() => result.current.handleBlockTarget(7, 9));

    expect(result.current.state.pieces.find(p => p.id === 'human1')!.position).toEqual({ col: 7, row: 10 });
    expect(result.current.state.blockChoice?.defenderId).toBe('orc1');
    expect(result.current.state.remainingMa).toBe(4);

    act(() => result.current.handleBlockOutcomeChoice(['defender-down'], 'defender-down'));
    act(() => result.current.handlePushChoice(7, 8, true));

    expect(result.current.state.blitzUsed).toBe(true);
    expect(result.current.state.selectedPieceId).toBe('human1');
    expect(result.current.state.remainingMa).toBe(4);
    expect(result.current.state.reachableKeys.size).toBeGreaterThan(0);
    expect(result.current.state.pieces.find(p => p.id === 'human1')!.activated).toBe(false);
    expect(result.current.state.pieces.find(p => p.id === 'human1')!.position).toEqual({ col: 7, row: 9 });

    // The player can spend remaining movement, then end the activation.
    act(() => result.current.handleSquareClick(7, 10));
    act(() => result.current.handleSquareClick(7, 10));
    expect(result.current.state.selectedPieceId).toBeNull();
    expect(result.current.state.pieces.find(p => p.id === 'human1')!.activated).toBe(true);
  });

  it('cannot be declared a second time in the same team turn', () => {
    const state = makeState([
      blocker({ position: { col: 7, row: 10 } }),
      blocker({ id: 'human2', name: 'Sera Quickhand', position: { col: 3, row: 3 } }),
      orc({ position: { col: 7, row: 9 } }),
    ]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleBlockAction('human1', true));
    act(() => result.current.handleBlockTarget(7, 9)); // choose target
    act(() => result.current.handleBlockTarget(7, 9)); // block from contact
    act(() => result.current.handleBlockOutcomeChoice(['attacker-down'], 'attacker-down'));

    expect(result.current.state.blitzUsed).toBe(true);

    act(() => result.current.handleBlockAction('human2', true));
    // Blitz is refused — no selection/targeting state was entered.
    expect(result.current.state.selectedPieceId).toBeNull();
    expect(result.current.state.pendingBlock).toBe(false);
  });

  it('plain Block is unaffected by blitzUsed', () => {
    const state = makeState([
      blocker({ position: { col: 7, row: 10 } }),
      blocker({ id: 'human2', name: 'Sera Quickhand', position: { col: 3, row: 3 } }),
      orc({ position: { col: 7, row: 9 } }),
      orc({ id: 'orc2', name: 'Muzgash', position: { col: 2, row: 3 } }),
    ]);
    const { result } = renderHook(() => useGameState(state));

    act(() => result.current.handleBlockAction('human1', true));
    act(() => result.current.handleBlockTarget(7, 9));
    act(() => result.current.handleBlockTarget(7, 9));
    act(() => result.current.handleBlockOutcomeChoice(['attacker-down'], 'attacker-down'));
    expect(result.current.state.blitzUsed).toBe(true);

    act(() => result.current.handleBlockAction('human2', false));
    expect(result.current.state.isBlockTargeting).toBe(true);
    expect(result.current.state.blockTargets.has('2,3')).toBe(true);
  });
});

describe('block probability math', () => {
  it('attacker-picks combined probability is 1-(1-p)^dice for the accepted subset', () => {
    // 2 dice, accepted = push + defender-down (weight 2+1=3 of 6 => p=0.5)
    const p = blockCombinedProbability(['push', 'defender-down'], 2, 'attacker');
    expect(p).toBeCloseTo(1 - Math.pow(0.5, 2), 6);
  });

  it('defender-picks combined probability is p^dice for the accepted subset', () => {
    const p = blockCombinedProbability(['attacker-down'], 2, 'defender');
    expect(p).toBeCloseTo(Math.pow(1 / 6, 2), 6);
  });
});
