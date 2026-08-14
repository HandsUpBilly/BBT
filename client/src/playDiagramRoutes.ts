import type { Position } from './types';

interface DiagramLogEntry {
  kind: string;
  pieceName: string;
  from: Position;
  to: Position;
}

export interface MovementRoute {
  pieceName: string;
  points: Position[];
}

function samePosition(a: Position, b: Position): boolean {
  return a.col === b.col && a.row === b.row;
}

/** Group the step-by-step log into the routes actually committed by each activation. */
export function buildMovementRoutes(actionLog: readonly DiagramLogEntry[]): MovementRoute[] {
  const routes: MovementRoute[] = [];
  let current: MovementRoute | undefined;

  for (const entry of actionLog) {
    if (entry.kind !== 'move') continue;
    const tip = current?.points.at(-1);
    if (!current || current.pieceName !== entry.pieceName || !tip || !samePosition(tip, entry.from)) {
      current = { pieceName: entry.pieceName, points: [entry.from, entry.to] };
      routes.push(current);
    } else if (!samePosition(tip, entry.to)) {
      current.points.push(entry.to);
    }
  }

  return routes;
}
