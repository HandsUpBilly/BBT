import type { GameState, PlayerPiece } from './types';
import { key, neighbours } from './bfs';
import { blitzTargetKeys } from './useGameState';

export function blockActionAvailability(
  attacker: PlayerPiece,
  state: GameState,
) {
  const canAct = !attacker.activated && !attacker.down;
  const adjacentKeys = new Set(neighbours(attacker.position).map(key));
  const hasAdjacentOpponent = state.pieces.some(piece =>
    piece.team !== attacker.team
      && !piece.down
      && adjacentKeys.has(key(piece.position))
  );

  return {
    canBlock: canAct && hasAdjacentOpponent,
    // Unlike a plain Block, a Blitz may move before choosing its target — but
    // only if it can actually reach contact with someone. Checking merely that
    // a standing opponent exists left the menu offering a Blitz that silently
    // did nothing when every opponent was out of range.
    //
    // Delegates to blitzTargetKeys, which is what handleBlockAction itself uses
    // to build the target set — so this check can't drift from the behavior it
    // is predicting. (An earlier fix duplicated the reachability walk here,
    // along with its own copy of MAX_GFI.)
    canBlitz: canAct && !state.blitzUsed && blitzTargetKeys(state, attacker).size > 0,
  };
}
