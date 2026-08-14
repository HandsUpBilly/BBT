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
 *   move together: one authored click is replayed into all of them, with roll
 *   targets recomputed against each branch's own board. A branch that can no
 *   longer follow leaves the group and is flagged for the player's attention.
 *   That is what makes a typical block cost zero extra authoring.
 * - **Derived weight.** Nothing here stores a probability per branch. The tree
 *   in blockBranchTree.ts computes values bottom-up and weights top-down, so
 *   `runSummary` is always the honest current picture — including weights
 *   shifting as a branch is authored, which is the real game rather than a
 *   glitch.
 */

import type { GameState, Position } from './types';
import {
  applyBlockBoardState,
  applyCancelSelection,
  applyClick,
  applyPushChoice,
  classifyClick,
  type ClickIntent,
} from './useGameState';
import { blockBoardStates, type BlockBoardState, type BlockResolution } from './blockBranching';
import { branchSummary, type BranchSummary, type LineNode } from './blockBranchTree';
import { replayClick } from './branchReplay';

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

const BOARD_STATE_LABELS: Record<BlockBoardState['kind'], string> = {
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
 * follow. Siblings that cannot are flagged and given their own lockstep id, so
 * later actions no longer touch them.
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

  const updates: RunLine[] = [{ ...viewed, state: nextViewedState, needsAttention: false }];
  let seq = run.seq;

  for (const sibling of lockstepGroup(run, viewed)) {
    const replayed = replay(sibling.state);
    if (replayed) {
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
  return authorAcrossGroup(
    run,
    applyCancelSelection,
    state => {
      const next = applyCancelSelection(state);
      return next === state ? null : next;
    },
  );
}

/**
 * Resolve the viewed branch's declared block by splitting it into one child per
 * live board state.
 *
 * Replaces the outcome checklist entirely: the player does not say what they
 * would accept, they just keep playing, in whichever branch they choose.
 */
export function splitOnBlock(run: BranchRun): BranchRun {
  const parent = viewedLine(run);
  const { state } = parent;
  const choice = state.blockChoice;
  if (!choice || !state.selectedPieceId) return run;

  const attacker = state.pieces.find(p => p.id === state.selectedPieceId);
  const defender = state.pieces.find(p => p.id === choice.defenderId);
  if (!attacker || !defender) return run;

  const resolution = blockBoardStates(attacker.skills, defender.skills);
  if (resolution.states.length === 0) {
    // Every face ends the drive. Nothing to author: the branch is simply dead.
    return withLines(run, [{ ...parent, conceded: true, state: { ...state, blockChoice: null } }]);
  }

  const ctx = { attackerId: attacker.id, defenderId: defender.id, isBlitz: choice.isBlitz };
  const startCumProb = cumProbOf(state);

  let seq = run.seq;
  const lockstepId = `G${seq++}`;
  const children: RunLine[] = resolution.states.map(boardState => ({
    id: `L${seq++}`,
    parentId: parent.id,
    label: BOARD_STATE_LABELS[boardState.kind],
    lockstepId,
    state: applyBlockBoardState(state, boardState, ctx),
    startCumProb,
    conceded: false,
    needsAttention: false,
    split: null,
  }));

  const split: RunSplit = {
    resolution,
    diceCount: choice.diceCount,
    picker: choice.picker,
    childIds: children.map(child => child.id),
  };

  const next = withLines(
    { ...run, seq },
    [{ ...parent, split, state: { ...state, blockChoice: null } }, ...children],
  );

  // Land the player in the first branch so play simply continues; every other
  // branch is following along in lockstep behind them.
  return { ...next, viewedId: children[0].id };
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

export interface BranchStripEntry {
  id: string;
  label: string;
  /** P(reaching this branch) — derived, and it moves as branches are authored. */
  weight: number;
  /** Conditional chance of scoring from here. */
  value: number;
  status: 'scored' | 'conceded' | 'needs-attention' | 'authoring';
  isViewed: boolean;
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
        weight: summary?.weight ?? 0,
        value: summary?.value ?? 0,
        status,
        isViewed: line.id === run.viewedId,
      };
    });
}
