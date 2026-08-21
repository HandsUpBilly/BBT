import { describe, expect, it } from 'vitest';
import type { GameState } from './types';
import { applyClick, classifyClick } from './useGameState';
import {
  addedRollCount,
  boardHash,
  groupByBoard,
  positionBeforeExtraTackleZone,
  replayAcrossBranches,
  replayClick,
  selectedPieceIsMarked,
} from './branchReplay';
import { makeState, humanBlocker, orcBlocker, humanThrower } from './test/gameState';

/** Board with a human carrier at (7,10) and one orc marking it at (7,9). */
function markedCarrier(orcOverrides = {}) {
  return makeState([
    humanThrower({ position: { col: 7, row: 10 } }),
    orcBlocker({ position: { col: 7, row: 9 }, ...orcOverrides }),
  ]);
}

/** Select a piece by clicking it, as the UI would. */
function select(state: GameState, col: number, row: number): GameState {
  return applyClick(state, { col, row });
}

describe('boardHash', () => {
  it('matches for two states with the same board', () => {
    expect(boardHash(markedCarrier())).toBe(boardHash(markedCarrier()));
  });

  it('ignores how a branch got here and what it cost', () => {
    const base = markedCarrier();
    const withHistory: GameState = {
      ...base,
      pendingProb: 0.42,
      actionLog: [{
        kind: 'move', pieceName: 'x', pieceRole: 'blocker',
        from: { col: 1, row: 1 }, to: { col: 1, row: 2 }, steps: 1,
        dodgeTarget: 3, isGfi: false, pickupTarget: null,
        actionProb: 0.5, cumulativeProb: 0.5,
      }],
      activationSnapshot: { pieces: base.pieces, ballPosition: null, remainingMa: 0, remainingGfi: 0 },
    };

    // Two branches being merged always differ in exactly these fields — that is
    // the whole point, so they must not affect the key.
    expect(boardHash(withHistory)).toBe(boardHash(base));
  });

  it('separates a standing defender from a prone one', () => {
    expect(boardHash(markedCarrier({ down: true }))).not.toBe(boardHash(markedCarrier()));
  });

  it('separates defenders standing on different squares', () => {
    expect(boardHash(markedCarrier({ position: { col: 8, row: 9 } })))
      .not.toBe(boardHash(markedCarrier()));
  });

  it('separates boards by who is holding the ball', () => {
    const carried = makeState([humanThrower({ hasBall: true })]);
    const loose = makeState([humanThrower({ hasBall: false })], 'human', { col: 7, row: 10 });
    expect(boardHash(carried)).not.toBe(boardHash(loose));
  });

  it('separates an activation in progress from one that has not started', () => {
    const idle = markedCarrier();
    expect(boardHash(select(idle, 7, 10))).not.toBe(boardHash(idle));
  });

  it('separates activations with different movement left', () => {
    const selected = select(markedCarrier(), 7, 10);
    expect(boardHash({ ...selected, remainingMa: 3 })).not.toBe(boardHash(selected));
  });

  it('separates activations by whether the Dodge reroll is still in hand', () => {
    const selected = select(markedCarrier(), 7, 10);
    expect(boardHash({ ...selected, dodgeRerollAvailability: 0 }))
      .not.toBe(boardHash({ ...selected, dodgeRerollAvailability: 1 }));
  });

  it('is order-independent across the piece list', () => {
    const a = makeState([humanBlocker(), orcBlocker()]);
    const b = makeState([orcBlocker(), humanBlocker()]);
    expect(boardHash(a)).toBe(boardHash(b));
  });
});

describe('groupByBoard', () => {
  it('folds identical boards together and keeps different ones apart', () => {
    const entries = [
      { id: 'a', state: markedCarrier() },
      { id: 'b', state: markedCarrier() },
      { id: 'c', state: markedCarrier({ down: true }) },
    ];

    const groups = groupByBoard(entries, e => e.state);

    expect(groups.size).toBe(2);
    const merged = [...groups.values()].find(g => g.length === 2);
    expect(merged?.map(e => e.id)).toEqual(['a', 'b']);
  });
});

describe('replayClick', () => {
  it('advances a branch where the click still means the same thing', () => {
    const state = select(markedCarrier(), 7, 10);
    const intent = classifyClick(state, { col: 7, row: 11 });
    expect(intent).toBe('commit-move');

    const result = replayClick(state, { col: 7, row: 11 }, intent);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state).not.toBe(state);
      expect(result.state.committedPath).toHaveLength(1);
    }
  });

  it('flags a branch where the same click would mean something else', () => {
    // A move far outside the carrier's range is not a move on any board, so it
    // classifies as a deselect instead — the exact silent failure that makes
    // replaying raw clicks unsafe.
    const state = select(markedCarrier(), 7, 10);
    const result = replayClick(state, { col: 0, row: 0 }, 'commit-move');

    expect(result).toMatchObject({
      ok: false, reason: 'intent-mismatch', expected: 'commit-move', actual: 'deselect',
    });
  });

  it('recomputes roll targets per branch instead of reusing the authored ones', () => {
    // The orc at (7,9) is prone in one branch and standing in the other. The
    // same click is legal in both, but only one of them has to dodge — this is
    // the whole point of replaying into siblings rather than copying results.
    const proneBranch = select(markedCarrier({ down: true }), 7, 10);
    const standingBranch = select(markedCarrier(), 7, 10);
    const target = { col: 7, row: 8 };

    const intent = classifyClick(proneBranch, target);
    const onProne = replayClick(proneBranch, target, intent);
    const onStanding = replayClick(standingBranch, target, intent);

    expect(onProne.ok).toBe(true);
    expect(onStanding.ok).toBe(true);
    if (!onProne.ok || !onStanding.ok) return;

    // Walking past a standing orc costs two 4+ dodges; past a prone one, none.
    expect(onProne.state.pendingDodgeTargets).toEqual([]);
    expect(onStanding.state.pendingDodgeTargets).toEqual([4, 4]);
    expect(onStanding.state.pendingProb).toBeLessThan(onProne.state.pendingProb);
  });

  it('refuses a click the reducer declines even when it classifies the same', () => {
    // phase is not 'playing', so every click is a no-op; forcing the expected
    // intent to match proves the no-op guard is what catches it.
    const state: GameState = { ...select(markedCarrier(), 7, 10), phase: 'touchdown' };
    const result = replayClick(state, { col: 7, row: 11 }, 'none');

    expect(result).toMatchObject({ ok: false, reason: 'no-op' });
  });
});

describe('addedRollCount', () => {
  it('counts the rolls a replay adds, including multiple tests on movement', () => {
    const proneBranch = select(markedCarrier({ down: true }), 7, 10);
    const standingBranch = select(markedCarrier(), 7, 10);
    const target = { col: 7, row: 8 };

    const safe = applyClick(proneBranch, target);
    const risky = applyClick(standingBranch, target);

    expect(addedRollCount(proneBranch, safe)).toBe(0);
    expect(addedRollCount(standingBranch, risky)).toBe(2);
  });
});

describe('anticipating a future dodge', () => {
  it('identifies the step before a sibling enters an extra tackle zone', () => {
    const mover = humanBlocker({ id: 'runner', position: { col: 6, row: 10 } });
    const safeBefore = select(makeState([
      mover,
      orcBlocker({ position: { col: 7, row: 8 }, down: true }),
    ]), 6, 10);
    const markedBefore = select(makeState([
      mover,
      orcBlocker({ position: { col: 7, row: 8 } }),
    ]), 6, 10);
    const safeAfter = applyClick(safeBefore, { col: 6, row: 9 });
    const markedAfter = applyClick(markedBefore, { col: 6, row: 9 });

    expect(selectedPieceIsMarked(safeAfter)).toBe(false);
    expect(selectedPieceIsMarked(markedAfter)).toBe(true);
    expect(positionBeforeExtraTackleZone(markedBefore, markedAfter, safeAfter))
      .toEqual({ col: 6, row: 10 });
  });
});

describe('replayAcrossBranches', () => {
  it('splits a lockstep group into advanced and flagged', () => {
    const branches = [
      { id: 'pushed-down', state: select(markedCarrier({ down: true }), 7, 10) },
      { id: 'pushed', state: select(markedCarrier(), 7, 10) },
    ];
    const target = { col: 0, row: 0 };

    const { advanced, flagged } = replayAcrossBranches(branches, target, 'commit-move', 0);

    // Nobody can reach the far corner, so both fall out together.
    expect(advanced).toHaveLength(0);
    expect(flagged.map(b => b.id)).toEqual(['pushed-down', 'pushed']);
  });

  it('leaves a flagged branch on its own board so it can be authored from there', () => {
    const branch = { id: 'pushed', state: select(markedCarrier(), 7, 10) };
    const { flagged } = replayAcrossBranches([branch], { col: 0, row: 0 }, 'commit-move', 0);

    expect(flagged[0].state).toBe(branch.state);
  });

  it('advances every branch that still agrees', () => {
    const branches = [
      { id: 'a', state: select(markedCarrier(), 7, 10) },
      { id: 'b', state: select(markedCarrier(), 7, 10) },
    ];

    // Both identical boards add the same one dodge roll, so they stay together.
    const { advanced, flagged } = replayAcrossBranches(branches, { col: 7, row: 11 }, 'commit-move', 1);

    expect(flagged).toHaveLength(0);
    expect(advanced.map(b => b.id)).toEqual(['a', 'b']);
    expect(advanced.every(b => b.state.committedPath.length === 1)).toBe(true);
  });

  it('leaves a legal branch untouched when replay would add another roll', () => {
    const branch = { id: 'standing', state: select(markedCarrier(), 7, 10) };
    const target = { col: 7, row: 8 };

    const { advanced, flagged } = replayAcrossBranches(
      [branch], target, classifyClick(branch.state, target), 0,
    );

    expect(advanced).toHaveLength(0);
    expect(flagged).toHaveLength(1);
    expect(flagged[0].state).toBe(branch.state);
    expect(flagged[0].failure).toMatchObject({ reason: 'extra-rolls', added: 2, allowed: 0 });
  });
});
