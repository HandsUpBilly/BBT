/**
 * Phase 2 of the board-state branching model — the two primitives that let one
 * authored line serve several branches. See spec.md, "Block Outcomes as
 * Board-State Branches".
 *
 * `boardHash` is the merge key: two branches whose boards hash the same are
 * interchangeable from here on, so they can share one continuation. Merging is
 * always sound — an identical board makes any continuation legal in one legal
 * in the other — and it is what keeps a multi-block puzzle from being a pile of
 * independent authoring jobs.
 *
 * `replayClick` produces a candidate lockstep replay: apply the click the
 * player just made to a sibling branch and say plainly whether it still means
 * the same thing there. The group author then also compares `addedRollSignature`
 * against the viewed action before accepting that candidate. Both checks are
 * explicit because silently changing either the action or the dice it needs in
 * a sibling would make the whole model untrustworthy.
 */

import type { ActionLogEntry, GameState, PlayerPiece, Position } from './types';
import { applyClick, classifyClick, type ClickIntent } from './useGameState';
import { key, tacklezoneKeys } from './bfs';

function piecePart(piece: PlayerPiece): string {
  // Position, prone state, and whether the piece has already gone are the only
  // things about a piece that change how the rest of the turn can play out.
  return [
    piece.id,
    piece.position.col,
    piece.position.row,
    piece.down ? 'd' : '-',
    piece.activated ? 'a' : '-',
    piece.hasBall ? 'b' : '-',
  ].join(':');
}

function posPart(pos: Position | null): string {
  return pos ? key(pos) : '-';
}

/**
 * A key identifying everything about a board that can still affect how the turn
 * plays out. Two states sharing a hash are interchangeable going forward.
 *
 * Deliberately *excludes* the action log, `pendingProb`, and the activation
 * snapshot: those record how a branch got here and what it cost, which is
 * exactly the part that legitimately differs between branches being merged.
 * The tree keeps those apart as separate weights above the shared subtree.
 *
 * Deliberately *includes* everything about an activation in progress —
 * remaining movement, the reroll state, the declared-action flags — because a
 * branch mid-activation can only share a continuation with one at the same
 * point. Over-including costs a missed merge; under-including would merge two
 * boards that are not actually the same, so this errs towards the former.
 */
export function boardHash(state: GameState): string {
  const pieces = state.pieces.map(piecePart).sort().join('|');
  const base = [
    pieces,
    posPart(state.ballPosition),
    state.activeTeam,
    state.phase,
    state.passUsed ? 'P' : '-',
    state.blitzUsed ? 'B' : '-',
    state.blitzResumeId ?? '-',
    state.selectedPieceId ?? '-',
  ].join('/');

  if (!state.selectedPieceId) return base;

  const activation = [
    state.remainingMa,
    state.remainingGfi,
    // Carries the state of the one Dodge skill reroll, so it changes what every
    // later dodge in this activation is worth.
    state.dodgeRerollAvailability.toFixed(6),
    posPart(state.originPos),
    posPart(state.committedPath[state.committedPath.length - 1] ?? null),
    state.pendingPass ? 'p' : '-',
    state.pendingHandoff ? 'h' : '-',
    state.pendingBlock ? 'k' : '-',
    state.isPassTargeting ? 'P' : '-',
    state.isHandoffTargeting ? 'H' : '-',
    state.isBlockTargeting ? 'K' : '-',
    state.blitzTargetId ?? '-',
  ].join(',');

  return `${base}/${activation}`;
}

/** Group branch states by board, returning one entry per distinct board. */
export function groupByBoard<T>(
  entries: readonly T[],
  stateOf: (entry: T) => GameState,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const entry of entries) {
    const hash = boardHash(stateOf(entry));
    const existing = groups.get(hash);
    if (existing) existing.push(entry);
    else groups.set(hash, [entry]);
  }
  return groups;
}

export type ReplayFailure =
  /** The click means something different on this board (usually unreachable). */
  | { ok: false; reason: 'intent-mismatch'; expected: ClickIntent; actual: ClickIntent }
  /** The click was classified the same but the reducer declined it. */
  | { ok: false; reason: 'no-op'; expected: ClickIntent; actual: ClickIntent }
  /** The click is legal but adds rolls beyond those accepted on the viewed board. */
  | {
      ok: false;
      reason: 'extra-rolls';
      expected: ClickIntent;
      actual: ClickIntent;
      added: number;
      allowed: number;
    };

export type ReplayResult =
  | { ok: true; state: GameState; intent: ClickIntent }
  | ReplayFailure;

/** Number of individual rolls represented by one newly appended log entry. */
function entryRollCount(entry: ActionLogEntry): number {
  if (entry.kind !== 'move') return 1;
  return Number(entry.dodgeTarget !== null)
    + Number(entry.isGfi)
    + Number(entry.pickupTarget !== null && entry.pickupTarget !== undefined);
}

/**
 * Describe the individual dice introduced by one log entry.
 *
 * A count alone is not enough for lockstep: a 3+ pickup and a 4+ pickup are
 * both one roll, but they are different plans. Conversely, an unchanged 3+
 * pickup must remain in lockstep even though it is a dice-bearing move.
 */
function entryRollSignature(entry: ActionLogEntry): string[] {
  if (entry.kind === 'move') {
    const rolls: string[] = [];
    if (entry.dodgeTarget !== null) {
      rolls.push(`dodge:${entry.dodgeTarget}:${entry.dodgeSkillReroll ? 'skill' : 'plain'}`);
    }
    if (entry.isGfi) rolls.push('rush:2');
    if (entry.pickupTarget !== null && entry.pickupTarget !== undefined) {
      rolls.push(`pickup:${entry.pickupTarget}`);
    }
    return rolls;
  }
  if (entry.kind === 'handoff' || entry.kind === 'pass-catch') {
    return [`catch:${entry.catchTarget}`];
  }
  if (entry.kind === 'pass') {
    return [`pass:${entry.passTarget}`];
  }
  return [`block:${entry.diceCount}:${entry.picker}`];
}

/**
 * Count only rolls introduced by one state transition.
 *
 * Movement can stack a dodge, Rush and pickup on one square, so counting
 * roll-bearing log entries would miss exactly the extra risk lockstep replay
 * must detect. Log truncation during cancellation introduces no new rolls.
 */
export function addedRollCount(before: GameState, after: GameState): number {
  if (after.actionLog.length <= before.actionLog.length) return 0;
  return after.actionLog
    .slice(before.actionLog.length)
    .reduce((total, entry) => total + entryRollCount(entry), 0);
}

/** The ordered dice requirements introduced by one state transition. */
export function addedRollSignature(before: GameState, after: GameState): string[] {
  if (after.actionLog.length <= before.actionLog.length) return [];
  return after.actionLog
    .slice(before.actionLog.length)
    .flatMap(entryRollSignature);
}

/** True when replaying an action introduces exactly the same dice. */
export function addedRollsMatch(
  viewedBefore: GameState,
  viewedAfter: GameState,
  siblingBefore: GameState,
  siblingAfter: GameState,
): boolean {
  const viewedRolls = addedRollSignature(viewedBefore, viewedAfter);
  const siblingRolls = addedRollSignature(siblingBefore, siblingAfter);
  return viewedRolls.length === siblingRolls.length
    && viewedRolls.every((roll, index) => roll === siblingRolls[index]);
}

function selectedPiecePosition(state: GameState): Position | null {
  if (!state.selectedPieceId) return null;
  return state.committedPath[state.committedPath.length - 1]
    ?? state.originPos
    ?? state.pieces.find(piece => piece.id === state.selectedPieceId)?.position
    ?? null;
}

/** Whether the active mover would have to dodge when leaving its current square. */
export function selectedPieceIsMarked(state: GameState): boolean {
  const selected = state.pieces.find(piece => piece.id === state.selectedPieceId);
  const position = selectedPiecePosition(state);
  if (!selected || !position) return false;
  const opponents = state.pieces
    .filter(piece => piece.team !== selected.team && !piece.down)
    .map(piece => piece.position);
  return tacklezoneKeys(opponents).has(key(position));
}

/**
 * Find the square immediately before a sibling replay enters an extra tackle
 * zone that the authored branch does not enter. Returning that predecessor
 * lets the sibling keep the safe prefix of a multi-square click, then stop and
 * ask for its own plan before it becomes committed to a future dodge.
 */
export function positionBeforeExtraTackleZone(
  before: GameState,
  replayed: GameState,
  viewedAfter: GameState,
): Position | null {
  const beforePosition = selectedPiecePosition(before);
  const replayedPosition = selectedPiecePosition(replayed);
  if (!beforePosition || !replayedPosition) return null;
  if (key(beforePosition) === key(replayedPosition)) return null;
  if (!selectedPieceIsMarked(replayed) || selectedPieceIsMarked(viewedAfter)) return null;

  const finalMove = replayed.actionLog
    .slice(before.actionLog.length)
    .findLast(entry => entry.kind === 'move' && key(entry.to) === key(replayedPosition));
  return finalMove?.from ?? null;
}

/**
 * Replay a click into a sibling branch, refusing it unless it means the same
 * thing there as it did in the branch the player was looking at.
 *
 * The `no-op` case catches the reducer's internal bail-outs — `reachableKeys`
 * claimed a square was reachable but pathfinding disagreed, say. Those return
 * the state unchanged, which would otherwise look like a successful replay and
 * leave the branch silently one action behind its siblings.
 */
export function replayClick(
  state: GameState,
  pos: Position,
  expected: ClickIntent,
): ReplayResult {
  const actual = classifyClick(state, pos);
  if (actual !== expected) return { ok: false, reason: 'intent-mismatch', expected, actual };

  const next = applyClick(state, pos);
  if (next === state) return { ok: false, reason: 'no-op', expected, actual };

  return { ok: true, state: next, intent: actual };
}
