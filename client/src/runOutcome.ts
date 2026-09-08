import type { BranchStripEntry } from './branchRun';
import type { GameState } from './types';
import { blitzTargetKeys } from './useGameState';

/**
 * A carried ball cannot change hands or reach the end zone once its carrier's
 * activation is spent. With the board still in play, that makes the one-turn
 * touchdown objective impossible in this universe. A crowd-surf puzzle is
 * likewise stalled once no standing, unactivated player can legally Block or
 * Blitz an opponent.
 */
export function isScoringRunStalled(state: GameState): boolean {
  if (state.phase !== 'playing') return false;
  if (state.objective === 'touchdown') {
    return state.pieces.some(piece =>
      piece.team === state.activeTeam
      && piece.hasBall
      && piece.activated,
    );
  }

  // Never fail during a reversible activation or while a block/push has a
  // required resolution still outstanding.
  if (state.selectedPieceId || state.blockChoice || state.pendingBlockResolution) return false;

  return !state.pieces.some(attacker => {
    if (attacker.team !== state.activeTeam || attacker.activated || attacker.down) return false;
    return blitzTargetKeys(state, attacker).size > 0;
  });
}

export function unfinishedBranches(branches: readonly BranchStripEntry[]): BranchStripEntry[] {
  return branches.filter(branch =>
    branch.status === 'authoring' || branch.status === 'needs-attention');
}
