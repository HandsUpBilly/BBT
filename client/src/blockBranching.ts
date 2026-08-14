/**
 * Phase 1 of the board-state branching model for block dice — see spec.md,
 * "Block Outcomes as Board-State Branches".
 *
 * Two pure steps, no `GameState` and no UI (that is phase 2):
 *
 * 1. `blockBoardStates` maps the five die faces onto the distinct *boards* they
 *    actually produce once skills resolve. Faces that leave the pitch in the
 *    same arrangement collapse into one state here rather than being tracked
 *    separately and reconciled later — Defender Stumbles and Defender Down are
 *    literally the same board when the defender has no Dodge.
 *
 * 2. `blockStateProbabilities` derives how likely each of those states is. With
 *    2–3 dice the picking side chooses *after* seeing the roll, so this is a
 *    decision made under information, not a chance node. Because only the
 *    resulting board matters, the optimal policy is a preference ordering over
 *    board states — and the caller does not have to author it: rank by what
 *    each state is worth and the weights follow in closed form.
 *
 * This generalises `blockCombinedProbability` rather than replacing it. Feed in
 * binary values (1 for the states you would accept, 0 for the rest) and the
 * numbers here reduce to exactly that function, which is asserted as a property
 * test in blockBranching.test.ts.
 */

import { BLOCK_FACE_WEIGHTS, BLOCK_OUTCOME_FACES } from './bfs';
import type { BlockOutcomeFace } from './types';
import { blockStateWeights } from '../../shared/blockWeights.js';

/**
 * The distinct boards a block can leave behind, other than the ones that end
 * the drive. Listed in the order used to break ties between equally valuable
 * states, so a split is deterministic; the node's value is the same whichever
 * of a tied pair is preferred.
 */
export const BLOCK_BOARD_STATE_KINDS = [
  'defender-pushed-down',
  'defender-down-in-place',
  'defender-pushed',
  'no-effect',
] as const;

export type BlockBoardStateKind = typeof BLOCK_BOARD_STATE_KINDS[number];

export interface BlockBoardState {
  kind: BlockBoardStateKind;
  /** How many of the die's 6 faces produce this board. */
  faceCount: number;
  /** The faces that collapsed into it — for the action log and branch labels. */
  faces: BlockOutcomeFace[];
  /**
   * Defender moves one square directly away. Which square (and whether the
   * attacker follows up) stays an in-branch player choice, not a branch —
   * only dice fork the world.
   */
  defenderPushed: boolean;
  /** Defender ends the block prone, so it stops projecting a tackle zone. */
  defenderFalls: boolean;
}

export interface BlockResolution {
  /** Live board states, in `BLOCK_BOARD_STATE_KINDS` order. */
  states: BlockBoardState[];
  /**
   * Faces that knock the attacker over and end the drive. Never materialised
   * as a branch: there is nothing to author in it and it is always worth 0.
   */
  deadFaceCount: number;
}

const STATE_SHAPE: Record<BlockBoardStateKind, { defenderPushed: boolean; defenderFalls: boolean }> = {
  'defender-pushed-down': { defenderPushed: true, defenderFalls: true },
  'defender-down-in-place': { defenderPushed: false, defenderFalls: true },
  'defender-pushed': { defenderPushed: true, defenderFalls: false },
  'no-effect': { defenderPushed: false, defenderFalls: false },
};

/**
 * Both Down is live only when the attacker has Block. Wrestle without Block
 * places the attacker prone too, so it ends the drive exactly like having
 * neither skill — matching `handleBlockOutcomeChoice` in useGameState.ts.
 */
function bothDownKind(
  attackerSkills: readonly string[],
  defenderSkills: readonly string[],
): BlockBoardStateKind | null {
  if (!attackerSkills.includes('Block')) return null;
  return defenderSkills.includes('Block') ? 'no-effect' : 'defender-down-in-place';
}

/** Dodge downgrades Stumbles to a plain push, unless the attacker has Tackle. */
function stumblesKind(
  attackerSkills: readonly string[],
  defenderSkills: readonly string[],
): BlockBoardStateKind {
  const dodgesAway = defenderSkills.includes('Dodge') && !attackerSkills.includes('Tackle');
  return dodgesAway ? 'defender-pushed' : 'defender-pushed-down';
}

/**
 * Collapse the five faces into the live board states they produce, with the
 * skills that affect the mapping (Block, Wrestle, Dodge, Tackle) resolved up
 * front. A `null` kind means the face ends the drive.
 */
export function blockBoardStates(
  attackerSkills: readonly string[],
  defenderSkills: readonly string[],
): BlockResolution {
  const faceKinds: Record<BlockOutcomeFace, BlockBoardStateKind | null> = {
    'attacker-down': null,
    'both-down': bothDownKind(attackerSkills, defenderSkills),
    'push': 'defender-pushed',
    'defender-stumbles': stumblesKind(attackerSkills, defenderSkills),
    'defender-down': 'defender-pushed-down',
  };

  const byKind = new Map<BlockBoardStateKind, BlockBoardState>();
  let deadFaceCount = 0;

  for (const face of BLOCK_OUTCOME_FACES) {
    const kind = faceKinds[face];
    const weight = BLOCK_FACE_WEIGHTS[face];
    if (kind === null) {
      deadFaceCount += weight;
      continue;
    }
    const existing = byKind.get(kind);
    if (existing) {
      existing.faceCount += weight;
      existing.faces.push(face);
    } else {
      byKind.set(kind, { kind, faceCount: weight, faces: [face], ...STATE_SHAPE[kind] });
    }
  }

  const states = BLOCK_BOARD_STATE_KINDS
    .map(kind => byKind.get(kind))
    .filter((state): state is BlockBoardState => state !== undefined);

  return { states, deadFaceCount };
}

export interface BlockStateProbabilities {
  /** P(this board state is the one that happens), aligned with `states`. */
  probabilities: number[];
  /** P(the block ends the drive) — the weight that never gets authored. */
  deadProbability: number;
  /** Indices into `states`, best-first, as the picking side ranks them. */
  order: number[];
}

/**
 * Derive each board state's probability from what it is worth.
 *
 * A typed wrapper over `shared/blockWeights.js`, which carries the closed form
 * and its derivation. The maths lives in `shared/` because the server-side
 * score validator has to reach the identical number from a submitted tree —
 * two implementations would disagree in the last decimal place and start
 * rejecting honest scores.
 *
 * `values` is the conditional chance of scoring from each state, aligned with
 * `resolution.states`; a missing or conceded entry counts as 0.
 */
export function blockStateProbabilities(
  resolution: BlockResolution,
  values: readonly number[],
  diceCount: 1 | 2 | 3,
  picker: 'attacker' | 'defender',
): BlockStateProbabilities {
  return blockStateWeights(
    resolution.states.map(state => state.faceCount),
    resolution.deadFaceCount,
    [...values],
    diceCount,
    picker,
  );
}

/**
 * The block's contribution to the line: the expected chance of scoring across
 * every board state it can leave behind. This is the value the branch set folds
 * into its parent in phase 2.
 */
export function blockNodeValue(
  resolution: BlockResolution,
  values: readonly number[],
  diceCount: 1 | 2 | 3,
  picker: 'attacker' | 'defender',
): number {
  const { probabilities } = blockStateProbabilities(resolution, values, diceCount, picker);
  return probabilities.reduce((total, p, index) => total + p * (values[index] ?? 0), 0);
}
