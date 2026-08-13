import { key } from './bfs';
import type { ActionLogEntry, Position } from './types';

export interface PathTrail {
  from: Position;
  to: Position | null;
  terminal?: boolean;
}

function samePosition(a: Position, b: Position): boolean {
  return a.col === b.col && a.row === b.row;
}

/**
 * SVG polyline points for one square's slice of a movement trail, in a
 * 0–100 viewBox: in from the previous square, turn at the centre, out toward
 * the next.
 *
 * Orientation-aware because the board is. Landscape draws state rows across
 * the screen and state cols down it; portrait transposes that. Left hardcoded
 * to the landscape mapping, every trail on a portrait board points ninety
 * degrees away from the route it describes.
 *
 * A pure function rather than inline JSX so both orientations can be asserted
 * — this is silent when wrong, since a trail always looks like a plausible
 * trail.
 */
export function trailPolylinePoints(
  trail: PathTrail,
  pCol: number,
  pRow: number,
  portrait: boolean,
): string {
  const across = (p: Position) => (portrait ? p.col : p.row);
  const down = (p: Position) => (portrait ? p.row : p.col);
  const here = { col: pCol, row: pRow };

  const enterX = 50 - (across(here) - across(trail.from)) * 50;
  const enterY = 50 - (down(here) - down(trail.from)) * 50;
  const exitX = trail.to ? 50 + (across(trail.to) - across(here)) * 50 : 50;
  const exitY = trail.to ? 50 + (down(trail.to) - down(here)) * 50 : 50;

  return `${enterX},${enterY} 50,50 ${exitX},${exitY}`;
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
        terminal: index === path.length - 1,
      };
      const squareTrails = trails.get(key(pos));
      if (squareTrails) squareTrails.push(pathTrail);
      else trails.set(key(pos), [pathTrail]);
    });
  }

  return trails;
}
