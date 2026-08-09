import type { ActionLogEntry } from './types';

/**
 * True when this step made the player roll for something.
 *
 * Such a step can never be folded into a neighbour: merging keeps only one
 * entry's roll fields, so the other roll would vanish from the log while
 * still counting toward the cumulative probability.
 */
export function entryHasRoll(e: ActionLogEntry): boolean {
  if (e.kind !== 'move') return true;
  return e.isGfi || e.dodgeTarget !== null || !!e.pickupTarget;
}

function movementDirection(e: ActionLogEntry): string | null {
  if (e.kind !== 'move') return null;
  return `${Math.sign(e.to.col - e.from.col)},${Math.sign(e.to.row - e.from.row)}`;
}

/**
 * Collapse a straight unbroken walk into a single line.
 *
 * Only plain steps merge. The "same direction" test used to key off a helper
 * that returned null for any roll-bearing step, so two consecutive rolls both
 * produced null, compared equal, and merged — and the merge kept only the
 * earlier entry's roll fields. Two Go For It rushes in a row showed as one
 * GFI; a dodge followed by another dodge showed as one dodge. The cumulative
 * total still counted both, so the log contradicted its own footer, in a game
 * whose entire score is the product of those rolls.
 */
export function compactDisplayLog(log: ActionLogEntry[]): ActionLogEntry[] {
  return log.reduce<ActionLogEntry[]>((entries, entry) => {
    const previous = entries[entries.length - 1];
    if (
      previous?.kind === 'move' &&
      entry.kind === 'move' &&
      !entryHasRoll(previous) &&
      !entryHasRoll(entry) &&
      previous.pieceName === entry.pieceName &&
      previous.pieceRole === entry.pieceRole &&
      previous.to.col === entry.from.col &&
      previous.to.row === entry.from.row &&
      movementDirection(previous) === movementDirection(entry)
    ) {
      entries[entries.length - 1] = {
        ...previous,
        to: entry.to,
        steps: previous.steps + entry.steps,
        cumulativeProb: entry.cumulativeProb,
      };
      return entries;
    }
    entries.push(entry);
    return entries;
  }, []);
}

/** Number of rolls the log actually contains, for the toolbar badge. */
export function rollCount(log: ActionLogEntry[]): number {
  return log.filter(entryHasRoll).length;
}
