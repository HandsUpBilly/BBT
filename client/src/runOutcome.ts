import type { BranchStripEntry } from './branchRun';
import type { GameState } from './types';

/**
 * A carried ball cannot change hands or reach the end zone once its carrier's
 * activation is spent. With the board still in play, that makes the one-turn
 * touchdown objective impossible in this universe.
 */
export function isScoringRunStalled(state: GameState): boolean {
  if (state.phase !== 'playing') return false;
  return state.pieces.some(piece =>
    piece.team === state.activeTeam
    && piece.hasBall
    && piece.activated,
  );
}

export function unfinishedBranches(branches: readonly BranchStripEntry[]): BranchStripEntry[] {
  return branches.filter(branch =>
    branch.status === 'authoring' || branch.status === 'needs-attention');
}
