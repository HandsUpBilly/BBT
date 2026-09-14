import type { BranchStripEntry } from './branchRun';
import type { GameState, PuzzleAction } from './types';
import { blockActionAvailability } from './blockActionAvailability';
import { OBJECTIVE_REQUIRED_ACTIONS, SCENARIO_ACTIONS } from '../../shared/scenarioValidation.js';

/**
 * True when the puzzle's objective has become unreachable while the board is
 * still live — the cue for the Drive-failed dialog, which is the only way out
 * of a run that can no longer be completed.
 *
 * Every objective needs one, not just Touchdown. A puzzle is a single turn
 * with no failure roll, so without this the player is left on a live board
 * with nothing legal to do and no dialog offering a restart.
 *
 * The checks below are sound but not complete: each detects a position that is
 * *definitely* lost, and neither claims to catch every one. A boxed-in carrier
 * with an activation left, for instance, has always been missed here.
 *
 * @param enabledActions the puzzle's allowed actions; defaults to all five,
 *   which is what an omitted `enabledActions` means for a legacy scenario.
 */
export function isScoringRunStalled(
  state: GameState,
  enabledActions: readonly PuzzleAction[] = SCENARIO_ACTIONS,
): boolean {
  if (state.phase !== 'playing') return false;

  // A puzzle saved before scenarioActionErrors() existed can have every route
  // to its own objective switched off. Nothing in the run can recover that.
  const routes = OBJECTIVE_REQUIRED_ACTIONS[state.objective] ?? [];
  const openRoutes = routes.filter(action => enabledActions.includes(action));
  if (routes.length > 0 && openRoutes.length === 0) return true;

  // Only a push can send a player into the crowd, and only a Block or a Blitz
  // can produce a push — so once no piece can do either, the surf can never
  // happen. This is the crowd-surf counterpart of the spent-carrier check.
  if (state.objective === 'crowd-surf') {
    return !state.pieces.some(piece => {
      if (piece.team !== state.activeTeam) return false;
      const { canBlock, canBlitz } = blockActionAvailability(piece, state);
      return (canBlock && openRoutes.includes('block'))
        || (canBlitz && openRoutes.includes('blitz'));
    });
  }

  // Touchdown: a carried ball cannot change hands or reach the end zone once
  // its carrier's activation is spent.
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
