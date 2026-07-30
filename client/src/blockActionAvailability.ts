import type { PlayerPiece } from './types';
import { key, neighbours } from './bfs';

export function blockActionAvailability(
  attacker: PlayerPiece,
  pieces: PlayerPiece[],
  blitzUsed: boolean,
) {
  const canAct = !attacker.activated && !attacker.down;
  const adjacentKeys = new Set(neighbours(attacker.position).map(key));
  const hasAdjacentOpponent = pieces.some(piece =>
    piece.team !== attacker.team
      && !piece.down
      && adjacentKeys.has(key(piece.position))
  );

  return {
    canBlock: canAct && hasAdjacentOpponent,
    // Unlike a plain Block, a Blitz may move before choosing its target.
    canBlitz: canAct && !blitzUsed,
  };
}
