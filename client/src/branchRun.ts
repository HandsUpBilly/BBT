/**
 * Phase 2b of the board-state branching model — the run itself: a tree of board
 * states being authored together. See spec.md, "Block Outcomes as Board-State
 * Branches".
 *
 * Pure and headless on purpose. Every transition is `BranchRun -> BranchRun`,
 * so the whole model can be driven from tests without React, and the hook that
 * wraps it is a `useState` plus a handful of callbacks.
 *
 * Two ideas carry the design:
 *
 * - **Lockstep.** Branches created by the same block share a `lockstepId` and
 *   move together while the same authored click stays legal without adding
 *   rolls beyond the viewed branch. Roll targets are recomputed against each
 *   board, but a branch that becomes illegal or riskier leaves the group before
 *   recording the click and is flagged for the player's attention.
 * - **Derived weight.** Nothing here stores a probability per branch. The tree
 *   in blockBranchTree.ts computes values bottom-up and weights top-down, so
 *   `runSummary` is always the honest current picture — including weights
 *   shifting as a branch is authored, which is the real game rather than a
 *   glitch.
 */

import type { GameState, Position, RiskyMove } from './types';
import {
  applyBlockAction,
  applyBlockBoardState,
  applyBlockTarget,
  applyCancelSelection,
  applyClick,
  applyHandoffAction,
  applyHandoffTarget,
  applyPassAction,
  applyPassTarget,
  applyPushChoice,
  classifyClick,
  type ClickIntent,
} from './useGameState';
import { blockBoardStates, type BlockBoardState, type BlockResolution } from './blockBranching';
import { branchSummary, type BranchSummary, type LineNode } from './blockBranchTree';
import { addedRollCount, replayClick } from './branchReplay';
import { summarizeActionLog } from './riskyMoves';

/** One authored segment: a board plus how it relates to the rest of the run. */
export interface RunLine {
  id: string;
  parentId: string | null;
  /** Short branch-strip label, from the board state that created this line. */
  label: string;
  /** Lines sharing this id move together when the player acts. */
  lockstepId: string;
  state: GameState;
  /** Cumulative roll probability at the moment this segment began. */
  startCumProb: number;
  /** Index into `state.actionLog` where this segment's own entries start. */
  startLogIndex: number;
  /** The player gave up here: costs its weight, costs no authoring. */
  conceded: boolean;
  /** Replay refused an inherited action, so this branch needs authoring. */
  needsAttention: boolean;
  /** Set once this segment ends in a block. */
  split: RunSplit | null;
}

export interface RunSplit {
  resolution: BlockResolution;
  diceCount: 1 | 2 | 3;
  picker: 'attacker' | 'defender';
  /**
   * Who was blocking whom. Carried on every child so a branch can always be
   * traced back to the specific block that forked it — a bare state name like
   * "Pushed" recurs across any block that can produce a push, so once a run
   * has more than one block in it, the name alone stops being an identity.
   */
  attackerName: string;
  defenderName: string;
  /** Child line ids, aligned with `resolution.states`. */
  childIds: string[];
}

export interface BranchRun {
  lines: Record<string, RunLine>;
  rootId: string;
  /** The branch the player is currently looking at and authoring. */
  viewedId: string;
  /** Monotonic counter behind generated ids, so they stay stable and unique. */
  seq: number;
}

/** Branch-strip label for each board state, reused by the pre-roll preview dialog. */
export const BOARD_STATE_LABELS: Record<BlockBoardState['kind'], string> = {
  'defender-pushed-down': 'Pushed + Down',
  'defender-down-in-place': 'Down in place',
  'defender-pushed': 'Pushed',
  'no-effect': 'No effect',
};

function cumProbOf(state: GameState): number {
  return state.actionLog.length > 0
    ? state.actionLog[state.actionLog.length - 1].cumulativeProb
    : 1;
}

/** Probability of the ordinary rolls committed inside this segment alone. */
export function lineProb(line: RunLine): number {
  return line.startCumProb > 0 ? cumProbOf(line.state) / line.startCumProb : 0;
}

export function startRun(state: GameState): BranchRun {
  const root: RunLine = {
    id: 'L0',
    parentId: null,
    label: 'Main',
    lockstepId: 'G0',
    state,
    startCumProb: cumProbOf(state),
    startLogIndex: state.actionLog.length,
    conceded: false,
    needsAttention: false,
    split: null,
  };
  return { lines: { [root.id]: root }, rootId: root.id, viewedId: root.id, seq: 1 };
}

export function viewedLine(run: BranchRun): RunLine {
  return run.lines[run.viewedId];
}

/** Lines still being authored: no split below them, not given up on. */
export function activeLines(run: BranchRun): RunLine[] {
  return Object.values(run.lines).filter(line => !line.split && !line.conceded);
}

/** Lines that still need the player to do something before the run is complete. */
export function unresolvedLines(run: BranchRun): RunLine[] {
  return activeLines(run).filter(line => line.state.phase !== 'touchdown');
}

/** True once every branch is scored, conceded, or dead — i.e. safe to submit. */
export function isRunComplete(run: BranchRun): boolean {
  return unresolvedLines(run).length === 0;
}

function lockstepGroup(run: BranchRun, line: RunLine): RunLine[] {
  return Object.values(run.lines).filter(other =>
    other.lockstepId === line.lockstepId
    && other.id !== line.id
    && !other.conceded
    && !other.split);
}

function withLines(run: BranchRun, updates: RunLine[]): BranchRun {
  const lines = { ...run.lines };
  for (const line of updates) lines[line.id] = line;
  return { ...run, lines };
}

export function selectBranch(run: BranchRun, id: string): BranchRun {
  if (!run.lines[id] || id === run.viewedId) return run;
  // Opening a flagged branch is the player acknowledging it; it stays out of
  // its old lockstep group, but it should stop nagging.
  const line = run.lines[id];
  const cleared = line.needsAttention ? { ...line, needsAttention: false } : line;
  return { ...withLines(run, [cleared]), viewedId: id };
}

/**
 * Apply an authored transition to the viewed branch and replay it across that
 * branch's lockstep group.
 *
 * `apply` runs on the viewed board; `replay` decides whether a sibling can
 * follow. A legal replay is still refused if it introduces more rolls than the
 * viewed action: the sibling stays at the exact decision point where its safer
 * route needs separate authoring. Refused siblings get their own lockstep id,
 * so later actions no longer touch them.
 */
function authorAcrossGroup(
  run: BranchRun,
  apply: (state: GameState) => GameState,
  replay: (state: GameState) => GameState | null,
): BranchRun {
  const viewed = viewedLine(run);
  if (viewed.conceded || viewed.split) return run;

  const nextViewedState = apply(viewed.state);
  if (nextViewedState === viewed.state) return run;
  const allowedAddedRolls = addedRollCount(viewed.state, nextViewedState);

  const updates: RunLine[] = [{ ...viewed, state: nextViewedState, needsAttention: false }];
  let seq = run.seq;

  for (const sibling of lockstepGroup(run, viewed)) {
    const replayed = replay(sibling.state);
    const addsNoExtraRolls = replayed
      && addedRollCount(sibling.state, replayed) <= allowedAddedRolls;
    if (replayed && addsNoExtraRolls) {
      updates.push({ ...sibling, state: replayed });
    } else {
      // Out of lockstep from here on: its own group, and flagged so the branch
      // strip can point the player at it.
      updates.push({ ...sibling, needsAttention: true, lockstepId: `G${seq++}` });
    }
  }

  return { ...withLines(run, updates), seq };
}

/**
 * Click a square in the viewed branch, replaying it into the lockstep group.
 *
 * The intent is classified once against the viewed board and every sibling has
 * to agree with it, because the reducer is total: an unreachable square would
 * otherwise quietly deselect the piece instead of failing.
 */
export function clickSquare(run: BranchRun, pos: Position): BranchRun {
  const viewed = viewedLine(run);
  const intent: ClickIntent = classifyClick(viewed.state, pos);
  if (intent === 'none') return run;

  return authorAcrossGroup(
    run,
    state => applyClick(state, pos),
    state => {
      const result = replayClick(state, pos, intent);
      return result.ok ? result.state : null;
    },
  );
}

/**
 * Author a transition that is the same instruction on every board — declaring
 * an action, picking a receiver, choosing a defender.
 *
 * A sibling where the reducer declines it has genuinely diverged: the receiver
 * drifted out of range, the defender is no longer adjacent, the blitz has no
 * movement left. Those are exactly the cases the player needs pointing at, so
 * they are flagged rather than skipped.
 */
function authorUniform(run: BranchRun, apply: (state: GameState) => GameState): BranchRun {
  return authorAcrossGroup(run, apply, state => {
    const next = apply(state);
    return next === state ? null : next;
  });
}

/** Declare a Hand Off for a piece, across the lockstep group. */
export function declareHandoff(run: BranchRun, pieceId: string): BranchRun {
  return authorUniform(run, state => applyHandoffAction(state, pieceId));
}

/** Pick a hand-off receiver. Catch targets are recomputed per branch. */
export function chooseHandoffTarget(run: BranchRun, pos: Position): BranchRun {
  return authorUniform(run, state => applyHandoffTarget(state, pos));
}

/** Declare a Pass for a piece, across the lockstep group. */
export function declarePass(run: BranchRun, pieceId: string): BranchRun {
  return authorUniform(run, state => applyPassAction(state, pieceId));
}

/** Pick a pass receiver. Pass and catch targets are recomputed per branch. */
export function choosePassTarget(run: BranchRun, pos: Position): BranchRun {
  return authorUniform(run, state => applyPassTarget(state, pos));
}

/** Declare a Block or Blitz for a piece, across the lockstep group. */
export function declareBlock(run: BranchRun, pieceId: string, isBlitz: boolean): BranchRun {
  return authorUniform(run, state => applyBlockAction(state, pieceId, isBlitz));
}

/**
 * Pick the defender to block. Dice count and picker are recomputed per branch,
 * since assists depend on who is standing where — so the same blitz can be two
 * dice in one branch and one in another.
 *
 * Does not split. The player never chooses which outcomes to accept — that is
 * the thing this model exists to remove — but they do still see the dice count
 * and the rough shape of the die before committing to rolling it, the same way
 * the game shows a dodge target before you click into it. `splitOnBlock` is a
 * separate step so the UI can put a confirm/cancel in between. (For a Blitz the
 * first click only nominates the target, so `blockChoice` isn't set until the
 * second.)
 */
export function chooseBlockTarget(run: BranchRun, pos: Position): BranchRun {
  return authorUniform(run, state => applyBlockTarget(state, pos));
}

/** True once the viewed branch has a block resolved and waiting to be split. */
export function isBlockPending(run: BranchRun): boolean {
  return viewedLine(run).state.blockChoice !== null;
}

/** Choose a push-back square (and follow-up) across the lockstep group. */
export function choosePush(run: BranchRun, pos: Position, followUp: boolean): BranchRun {
  return authorAcrossGroup(
    run,
    state => applyPushChoice(state, pos, followUp),
    state => {
      // A sibling that was never pushed — the Both Down knockdown, say — has
      // nothing to resolve here. That is not a divergence, so it passes through
      // untouched rather than being flagged for the player's attention.
      if (!state.pendingBlockResolution) return state;
      const next = applyPushChoice(state, pos, followUp);
      return next === state ? null : next;
    },
  );
}

/** Back out of the current activation across the whole lockstep group. */
export function cancelActivation(run: BranchRun): BranchRun {
  return authorUniform(run, applyCancelSelection);
}

/**
 * Resolve the viewed branch's declared block by splitting it into one child per
 * live board state.
 *
 * Replaces the outcome checklist entirely: the player does not say what they
 * would accept, they just keep playing, in whichever branch they choose.
 */
export function splitOnBlock(run: BranchRun): BranchRun {
  const viewed = viewedLine(run);
  if (!viewed.state.blockChoice) return run;

  // Every branch in the group with a block pending forks at once, because the
  // block was declared across the whole group. All the resulting children join
  // a single lockstep group: they were following one plan before the block and
  // there is no reason they cannot keep doing so, with the replay legality
  // check catching whichever of them the plan actually stops working on.
  const splitting = [viewed, ...lockstepGroup(run, viewed)]
    .filter(line => line.state.blockChoice !== null);

  let seq = run.seq;
  const lockstepId = `G${seq++}`;
  const updates: RunLine[] = [];
  let viewedId = run.viewedId;

  for (const parent of splitting) {
    const { state } = parent;
    const choice = state.blockChoice!;
    const cleared = { ...state, blockChoice: null };

    const attacker = state.pieces.find(p => p.id === state.selectedPieceId);
    const defender = state.pieces.find(p => p.id === choice.defenderId);
    if (!attacker || !defender) continue;

    const resolution = blockBoardStates(attacker.skills, defender.skills);
    if (resolution.states.length === 0) {
      // Every face ends the drive. Nothing to author: the branch is simply dead.
      updates.push({ ...parent, conceded: true, state: cleared });
      continue;
    }

    const ctx = { attackerId: attacker.id, defenderId: defender.id, isBlitz: choice.isBlitz };
    const startCumProb = cumProbOf(state);

    const children: RunLine[] = resolution.states.map(boardState => ({
      id: `L${seq++}`,
      parentId: parent.id,
      label: BOARD_STATE_LABELS[boardState.kind],
      lockstepId,
      state: applyBlockBoardState(state, boardState, ctx),
      startCumProb,
      // The block entry itself is logged at actionProb 1, so including it in
      // the child's segment leaves the segment product untouched while keeping
      // the block visible in that branch's own history.
      startLogIndex: state.actionLog.length,
      conceded: false,
      needsAttention: false,
      split: null,
    }));

    const split: RunSplit = {
      resolution,
      diceCount: choice.diceCount,
      picker: choice.picker,
      attackerName: attacker.name,
      defenderName: defender.name,
      childIds: children.map(child => child.id),
    };

    updates.push({ ...parent, split, state: cleared }, ...children);

    // Land the player in the first branch of the one they were looking at, so
    // play simply continues; everything else follows along in lockstep.
    if (parent.id === run.viewedId) viewedId = children[0].id;
  }

  if (updates.length === 0) return run;
  return { ...withLines({ ...run, seq }, updates), viewedId };
}

/**
 * Edit the viewed branch's board directly.
 *
 * An escape hatch for the surrounding app (resetting a phase flag, say), not a
 * way to author play: it bypasses lockstep entirely, so siblings do not follow.
 */
export function updateViewedState(
  run: BranchRun,
  update: (state: GameState) => GameState,
): BranchRun {
  const viewed = viewedLine(run);
  const next = update(viewed.state);
  return next === viewed.state ? run : withLines(run, [{ ...viewed, state: next }]);
}

/** Give up on a branch. It keeps its weight and contributes nothing. */
export function concedeBranch(run: BranchRun, id: string): BranchRun {
  const line = run.lines[id];
  if (!line || line.conceded || line.split) return run;
  return withLines(run, [{ ...line, conceded: true, needsAttention: false }]);
}

/** Build the evaluation tree for a subtree of the run. */
function toTree(run: BranchRun, id: string): LineNode {
  const line = run.lines[id];
  const prob = lineProb(line);

  if (line.split) {
    return {
      id,
      lineProb: prob,
      lineDice: line.split.diceCount,
      outcome: {
        kind: 'block',
        block: {
          resolution: line.split.resolution,
          diceCount: line.split.diceCount,
          picker: line.split.picker,
          children: line.split.childIds.map(childId => toTree(run, childId)),
        },
      },
    };
  }

  const kind = line.conceded
    ? 'conceded'
    : line.state.phase === 'touchdown' ? 'scored' : 'open';

  return { id, lineProb: prob, lineDice: 0, outcome: { kind } };
}

/** The run's current honest expected value, plus per-branch weights. */
export function runSummary(run: BranchRun): BranchSummary {
  return branchSummary(toTree(run, run.rootId));
}

/**
 * One segment of a run as the leaderboard receives it. Mirrors the shape
 * `validateBranchTree` in shared/scoreValidation.js recomputes.
 */
export interface SubmissionNode {
  /** Product of the ordinary rolls committed in this segment. */
  lineProb: number;
  /** Those rolls, for the leaderboard detail view. */
  moves: RiskyMove[];
  outcome: 'scored' | 'conceded' | 'block';
  block?: {
    diceCount: 1 | 2 | 3;
    picker: 'attacker' | 'defender';
    /** Faces producing each live board state, aligned with `children`. */
    faceCounts: number[];
    /** Faces that end the drive and are never branched. */
    deadFaceCount: number;
    children: SubmissionNode[];
  };
}

/**
 * Serialise the run for submission.
 *
 * Deliberately carries face counts rather than the skills they were derived
 * from: the server has to recompute the score, and the face-to-board collapse
 * is the client's rules engine talking. What the server *can* check is that the
 * counts add up to a die, that every board state has a branch, and that the
 * arithmetic on top of them is right — which is what keeps a tampered score out
 * of the sort key without pretending this is a cheat-proof boundary.
 *
 * A branch still being authored serialises as conceded, so a partial run is
 * never scored higher than it earned.
 */
export function toSubmissionTree(run: BranchRun, lineId: string = run.rootId): SubmissionNode {
  const line = run.lines[lineId];
  const segment = line.state.actionLog.slice(line.startLogIndex);
  const { moves } = summarizeActionLog(segment);
  const node: SubmissionNode = {
    lineProb: lineProb(line),
    moves,
    outcome: 'conceded',
  };

  if (line.split) {
    node.outcome = 'block';
    node.block = {
      diceCount: line.split.diceCount,
      picker: line.split.picker,
      faceCounts: line.split.resolution.states.map(state => state.faceCount),
      deadFaceCount: line.split.resolution.deadFaceCount,
      children: line.split.childIds.map(childId => toSubmissionTree(run, childId)),
    };
    return node;
  }

  if (!line.conceded && line.state.phase === 'touchdown') node.outcome = 'scored';
  return node;
}

export interface BranchStripEntry {
  id: string;
  label: string;
  /** Full lineage back to the block(s) that produced this branch — see `branchPath`. */
  path: string;
  /** P(reaching this branch) — derived, and it moves as branches are authored. */
  weight: number;
  /** Conditional chance of scoring from here. */
  value: number;
  status: 'scored' | 'conceded' | 'needs-attention' | 'authoring';
  isViewed: boolean;
}

export interface GhostPiece {
  pieceId: string;
  position: Position;
  down: boolean;
  /** Branches this placement occurs in, for the tooltip. */
  labels: string[];
}

/**
 * Where pieces sit in the *other* live branches, for the overlay.
 *
 * Only pieces whose square or prone state actually differs from the viewed
 * board are returned — drawing every piece of every branch is what turns the
 * overlay into soup once there is more than one block in play.
 */
export function ghostPieces(run: BranchRun): GhostPiece[] {
  const viewed = viewedLine(run);
  const here = new Map(viewed.state.pieces.map(p => [p.id, p]));
  const ghosts = new Map<string, GhostPiece>();

  for (const line of Object.values(run.lines)) {
    if (line.split || line.conceded || line.id === viewed.id) continue;

    for (const piece of line.state.pieces) {
      const mine = here.get(piece.id);
      if (!mine) continue;
      const samePlace = mine.position.col === piece.position.col
        && mine.position.row === piece.position.row;
      if (samePlace && mine.down === piece.down) continue;

      const id = `${piece.id}@${piece.position.col},${piece.position.row}:${piece.down}`;
      const existing = ghosts.get(id);
      // Full path, not the bare label: two different blocks can each leave a
      // defender "Pushed" onto the same square, and the tooltip has to say
      // which block put it there.
      const path = branchPath(run, line.id);
      if (existing) existing.labels.push(path);
      else {
        ghosts.set(id, {
          pieceId: piece.id,
          position: piece.position,
          down: piece.down,
          labels: [path],
        });
      }
    }
  }

  return [...ghosts.values()];
}

/**
 * Full trail of blocks and outcomes that produced `lineId`, root to leaf, as
 * one readable string — e.g. `"Cedric ⚔ Muzgash: Pushed"` for a line under one
 * block, or `"Cedric ⚔ Muzgash: Pushed → Aldric ⚔ Grukk: Push"` once a second
 * block forks inside the first.
 *
 * A bare board-state name is not an identity: any block can produce a
 * "Pushed" branch, so once a run has more than one block in it, two entirely
 * unrelated leaves can carry the same short label. Everywhere a branch is
 * shown to the player — the strip, the ghost overlay, the run summary — needs
 * this instead, so a permutation is always traceable to the specific block
 * that created it.
 */
export function branchPath(run: BranchRun, lineId: string): string {
  const segments: string[] = [];
  let current = run.lines[lineId];
  while (current.parentId) {
    const parent = run.lines[current.parentId];
    const split = parent.split;
    if (!split) break; // unreachable: a line only has a parent via that parent's split
    segments.unshift(`${split.attackerName} ⚔ ${split.defenderName}: ${current.label}`);
    current = parent;
  }
  return segments.length > 0 ? segments.join(' → ') : current.label;
}

/** Everything the branch strip needs, for branches that are still leaves. */
export function branchStrip(run: BranchRun): BranchStripEntry[] {
  const { lines } = runSummary(run);
  const weights = new Map(lines.map(line => [line.id, line]));

  return Object.values(run.lines)
    .filter(line => !line.split)
    .map(line => {
      const summary = weights.get(line.id);
      const status: BranchStripEntry['status'] = line.conceded
        ? 'conceded'
        : line.state.phase === 'touchdown' ? 'scored'
        : line.needsAttention ? 'needs-attention'
        : 'authoring';
      return {
        id: line.id,
        label: line.label,
        path: branchPath(run, line.id),
        weight: summary?.weight ?? 0,
        value: summary?.value ?? 0,
        status,
        isViewed: line.id === run.viewedId,
      };
    });
}
