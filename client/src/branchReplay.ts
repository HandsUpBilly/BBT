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
 * `replayClick` is lockstep replay: apply the click the player just made in the
 * branch they are looking at to a sibling branch, and say plainly whether it
 * still means the same thing there. It has to be explicit about that, because
 * the reducer is total — an unreachable square does not error, it quietly falls
 * through to "deselect the piece". Silently doing something else in a sibling
 * is the one failure mode that would make the whole model untrustworthy.
 */

import type { GameState, PlayerPiece, Position } from './types';
import { applyClick, classifyClick, type ClickIntent } from './useGameState';
import { key } from './bfs';

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
  | { ok: false; reason: 'no-op'; expected: ClickIntent; actual: ClickIntent };

export type ReplayResult =
  | { ok: true; state: GameState; intent: ClickIntent }
  | ReplayFailure;

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

export interface LockstepBranch {
  id: string;
  state: GameState;
}

export interface LockstepResult {
  /** Branches where the click still meant the same thing, already advanced. */
  advanced: LockstepBranch[];
  /** Branches that fell out of lockstep and now need the player's attention. */
  flagged: (LockstepBranch & { failure: ReplayFailure })[];
}

/**
 * Apply one click across a lockstep group. Branches that accept it stay in the
 * group; branches that do not are handed back flagged, with their board
 * untouched so the player can author from where it actually diverged.
 */
export function replayAcrossBranches(
  branches: readonly LockstepBranch[],
  pos: Position,
  expected: ClickIntent,
): LockstepResult {
  const advanced: LockstepBranch[] = [];
  const flagged: (LockstepBranch & { failure: ReplayFailure })[] = [];

  for (const branch of branches) {
    const result = replayClick(branch.state, pos, expected);
    if (result.ok) advanced.push({ id: branch.id, state: result.state });
    else flagged.push({ ...branch, failure: result });
  }

  return { advanced, flagged };
}
