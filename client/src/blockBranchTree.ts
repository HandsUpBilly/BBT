/**
 * Phase 2 of the board-state branching model — the authoring tree and its
 * evaluation. See spec.md, "Block Outcomes as Board-State Branches".
 *
 * The awkward part of branching, and the reason this is a tree rather than a
 * flat list of weighted branches: **a branch's weight is not known when the
 * block splits.** With 2–3 dice the picking side takes the best board it is
 * offered, so how often each board actually happens depends on what each one
 * turns out to be worth — which is not known until it has been authored. Weight
 * is therefore always derived, never stored.
 *
 * Evaluation is standard expectimax over two passes:
 *
 *   1. bottom-up  — `value(node)`, the conditional chance of scoring from here
 *   2. top-down   — `weight(node)`, the chance of getting here in the first place
 *
 * and the run's score is `value(root)`, which is also exactly the summed weight
 * of every line that reaches a touchdown. `branchSummary` asserts that identity
 * rather than assuming it.
 *
 * Nothing here knows about `GameState`; a line is identified by id and carries
 * only the numbers evaluation needs. Wiring the tree to real board states is the
 * next step.
 */

import { blockNodeValue, blockStateProbabilities, type BlockResolution } from './blockBranching';

/**
 * One stretch of authored play with no dice branching in it: everything from a
 * block split (or the start of the puzzle) up to the next block, or to the end.
 */
export interface LineNode {
  id: string;
  /**
   * Product of the ordinary roll probabilities committed in this segment —
   * dodge, GFI, pickup, catch, pass. Every one of those has exactly one live
   * branch (fail it and the turn is over), which is why they multiply instead
   * of splitting.
   */
  lineProb: number;
  /** Block dice rolled in this segment, for the leaderboard's dice tie-break. */
  lineDice?: number;
  outcome: LineOutcome;
}

export type LineOutcome =
  /** Still being authored — worth nothing yet, and ranks accordingly. */
  | { kind: 'open' }
  /** Reached the end zone. */
  | { kind: 'scored' }
  /** The player gave up on this branch. Costs its weight, costs no authoring. */
  | { kind: 'conceded' }
  /** The segment ends in a block, which forks the board. */
  | { kind: 'block'; block: BlockSplit };

export interface BlockSplit {
  resolution: BlockResolution;
  diceCount: 1 | 2 | 3;
  picker: 'attacker' | 'defender';
  /**
   * One child per live board state, aligned with `resolution.states`. A missing
   * entry is treated as conceded — the same as an unauthored branch being
   * worth 0 — so the tree stays evaluable while it is half-built.
   */
  children: (LineNode | undefined)[];
}

/** Convenience constructors, mostly so tests and callers read cleanly. */
export function openLine(id: string, lineProb = 1, lineDice = 0): LineNode {
  return { id, lineProb, lineDice, outcome: { kind: 'open' } };
}

export function scoredLine(id: string, lineProb = 1, lineDice = 0): LineNode {
  return { id, lineProb, lineDice, outcome: { kind: 'scored' } };
}

export function concededLine(id: string, lineProb = 1, lineDice = 0): LineNode {
  return { id, lineProb, lineDice, outcome: { kind: 'conceded' } };
}

/**
 * Conditional probability of scoring from the start of this segment, assuming
 * you got here at all.
 *
 * Open and conceded lines are worth 0. That is deliberate: an unauthored branch
 * ranks below an authored one, so the derived ordering only ever prefers a
 * board the player has actually shown how to use.
 */
export function branchValue(node: LineNode | undefined): number {
  if (!node) return 0;
  const { outcome } = node;
  switch (outcome.kind) {
    case 'scored':
      return node.lineProb;
    case 'open':
    case 'conceded':
      return 0;
    case 'block': {
      const { resolution, diceCount, picker, children } = outcome.block;
      const values = resolution.states.map((_, i) => branchValue(children[i]));
      return node.lineProb * blockNodeValue(resolution, values, diceCount, picker);
    }
  }
}

export interface LineWeight {
  id: string;
  /** P(reaching the end of this segment — i.e. every roll in it succeeded). */
  weight: number;
  /** Conditional chance of scoring from the start of this segment. */
  value: number;
  outcomeKind: LineOutcome['kind'];
}

export interface BranchSummary {
  /** The run's honest expected value: P(this policy scores). */
  score: number;
  /** Every line in the tree, in depth-first order. */
  lines: LineWeight[];
  /** Mass lost to blocks that put the attacker down. */
  deadWeight: number;
  /** Mass lost to failed ordinary rolls — dodge, GFI, pickup, catch, pass. */
  failedRollWeight: number;
  /** Mass sitting on branches that are neither scored nor dead. */
  unresolvedWeight: number;
  /** Weight-weighted mean number of block dice rolled, for the tie-break. */
  expectedDice: number;
}

/**
 * Walk the tree once values are known, distributing incoming probability down
 * through each split, and collect everything a caller needs to display.
 *
 * `score + deadWeight + failedRollWeight + unresolvedWeight` is 1 by
 * construction; the invariant is asserted in the tests rather than trusted.
 */
export function branchSummary(root: LineNode): BranchSummary {
  const lines: LineWeight[] = [];
  let deadWeight = 0;
  let failedRollWeight = 0;
  let unresolvedWeight = 0;
  let diceWeightSum = 0;

  const visit = (node: LineNode | undefined, incoming: number, diceSoFar: number): void => {
    // An unauthored branch still holds its weight — it is exactly the mass the
    // branch strip has to nag about, so it must not silently evaporate here.
    if (!node) {
      unresolvedWeight += incoming;
      return;
    }

    // Whatever share of `incoming` fails a roll inside this segment is gone.
    const survived = incoming * node.lineProb;
    failedRollWeight += incoming - survived;

    const dice = diceSoFar + (node.lineDice ?? 0);
    lines.push({
      id: node.id,
      weight: survived,
      value: branchValue(node),
      outcomeKind: node.outcome.kind,
    });

    if (node.outcome.kind === 'block') {
      const { resolution, diceCount, picker, children } = node.outcome.block;
      const values = resolution.states.map((_, i) => branchValue(children[i]));
      const { probabilities, deadProbability } = blockStateProbabilities(
        resolution, values, diceCount, picker,
      );
      deadWeight += survived * deadProbability;
      resolution.states.forEach((_, i) => visit(children[i], survived * probabilities[i], dice));
      return;
    }

    // Terminal segment.
    if (node.outcome.kind === 'scored') diceWeightSum += survived * dice;
    else unresolvedWeight += survived;
  };

  visit(root, 1, 0);

  const score = branchValue(root);
  return {
    score,
    lines,
    deadWeight,
    failedRollWeight,
    unresolvedWeight,
    expectedDice: score > 0 ? diceWeightSum / score : 0,
  };
}

/** Depth-first list of every line id in the tree. */
export function branchLineIds(root: LineNode): string[] {
  const ids: string[] = [];
  const visit = (node: LineNode | undefined) => {
    if (!node) return;
    ids.push(node.id);
    if (node.outcome.kind === 'block') node.outcome.block.children.forEach(visit);
  };
  visit(root);
  return ids;
}

/** Find a line by id, or `undefined` if the tree has no such line. */
export function findLine(root: LineNode, id: string): LineNode | undefined {
  if (root.id === id) return root;
  if (root.outcome.kind !== 'block') return undefined;
  for (const child of root.outcome.block.children) {
    if (!child) continue;
    const found = findLine(child, id);
    if (found) return found;
  }
  return undefined;
}

/**
 * Replace one line in the tree, returning a new tree. Structural sharing keeps
 * untouched subtrees identical, so React can skip them.
 */
export function replaceLine(root: LineNode, id: string, next: LineNode): LineNode {
  if (root.id === id) return next;
  if (root.outcome.kind !== 'block') return root;

  const { block } = root.outcome;
  let changed = false;
  const children = block.children.map(child => {
    if (!child) return child;
    const replaced = replaceLine(child, id, next);
    if (replaced !== child) changed = true;
    return replaced;
  });

  if (!changed) return root;
  return { ...root, outcome: { kind: 'block', block: { ...block, children } } };
}
