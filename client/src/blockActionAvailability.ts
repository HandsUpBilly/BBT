import type { PlayerPiece } from './types';
import { computeReachable, key, neighbours } from './bfs';

// Mirrors MAX_GFI in useGameState.ts — must match handleBlockAction's Blitz
// reachability calculation so this availability check doesn't enable a Blitz
// that immediately finds zero reachable targets.
const MAX_GFI = 2;

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

  // Unlike a plain Block, a Blitz may move before choosing its target — so it
  // should only be offered when the attacker can actually reach contact with
  // a standing opponent, not merely when one exists anywhere on the pitch.
  const others = pieces.filter(p => p.id !== attacker.id).map(p => p.position);
  const opponents = pieces.filter(p => p.team !== attacker.team && !p.down).map(p => p.position);
  const { reachableKeys } = computeReachable(attacker.position, attacker.ma, others, opponents, MAX_GFI);
  const hasReachableStandingOpponent = pieces.some(piece =>
    piece.team !== attacker.team
      && !piece.down
      && neighbours(piece.position).some(pos =>
        key(pos) === key(attacker.position) || reachableKeys.has(key(pos))
      )
  );

  return {
    canBlock: canAct && hasAdjacentOpponent,
    canBlitz: canAct && !blitzUsed && hasReachableStandingOpponent,
  };
}
