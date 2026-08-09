import { key } from './bfs';
import type { ActionLogEntry, Position } from './types';

export interface PathTrail {
  from: Position;
  to: Position | null;
}

function samePosition(a: Position, b: Position): boolean {
  return a.col === b.col && a.row === b.row;
}

/**
 * Build a trail for every committed move in the action log. Using the log
 * keeps a route visible after its piece's activation has ended, while the
 * activation rollback already removes cancelled movement from the same log.
 */
export function buildMovementTrailMap(actionLog: ActionLogEntry[]): Map<string, PathTrail[]> {
  const paths: Position[][] = [];
  let currentPath: Position[] | null = null;
  let currentPieceName: string | null = null;

  for (const entry of actionLog) {
    if (entry.kind !== 'move') continue;

    const currentTip = currentPath?.[currentPath.length - 1];
    if (!currentPath || currentPieceName !== entry.pieceName || !currentTip || !samePosition(currentTip, entry.from)) {
      currentPath = [entry.from, entry.to];
      currentPieceName = entry.pieceName;
      paths.push(currentPath);
    } else if (!samePosition(currentTip, entry.to)) {
      currentPath.push(entry.to);
    }
  }

  const trails = new Map<string, PathTrail[]>();
  for (const path of paths) {
    path.forEach((pos, index) => {
      const pathTrail = {
        from: path[index - 1] ?? pos,
        to: path[index + 1] ?? null,
      };
      const squareTrails = trails.get(key(pos));
      if (squareTrails) squareTrails.push(pathTrail);
      else trails.set(key(pos), [pathTrail]);
    });
  }

  return trails;
}
