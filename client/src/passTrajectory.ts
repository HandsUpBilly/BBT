import type { Position } from './types';

function rounded(value: number): number {
  return Number(value.toFixed(3));
}

/**
 * A completed pass is drawn as one quadratic arc over the pitch rather than
 * as square-by-square trail fragments. The bend keeps it visually distinct
 * from committed movement and reads as a thrown ball in either orientation.
 */
export function passTrajectoryPath(
  from: Position,
  to: Position,
  portrait: boolean,
  acrossStart: number,
  downStart: number,
): string {
  const point = (position: Position) => ({
    x: (portrait ? position.col : position.row) - acrossStart + 0.5,
    y: (portrait ? position.row : position.col) - downStart + 0.5,
  });
  const start = point(from);
  const end = point(to);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  const bend = Math.min(2.2, Math.max(0.7, length * 0.18));
  const normalX = length === 0 ? 0 : -dy / length;
  const normalY = length === 0 ? -1 : dx / length;
  const controlX = (start.x + end.x) / 2 + normalX * bend;
  const controlY = (start.y + end.y) / 2 + normalY * bend;

  return `M ${rounded(start.x)} ${rounded(start.y)} Q ${rounded(controlX)} ${rounded(controlY)} ${rounded(end.x)} ${rounded(end.y)}`;
}
