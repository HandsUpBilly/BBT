import type { ActionLogEntry } from './types';

export interface TutorialDrillRecap {
  actions: string[];
  probability: number;
}

export function tutorialActionSequence(log: readonly ActionLogEntry[]): string[] {
  const actions: string[] = [];
  let index = 0;
  while (index < log.length) {
    const entry = log[index];
    if (entry.kind === 'move') {
      let squares = entry.steps;
      let end = index + 1;
      while (end < log.length && log[end].kind === 'move' && log[end].pieceName === entry.pieceName) {
        const move = log[end];
        if (move.kind === 'move') squares += move.steps;
        end += 1;
      }
      actions.push(`Moved ${entry.pieceName} ${squares} square${squares === 1 ? '' : 's'}`);
      index = end;
      continue;
    }
    if (entry.kind === 'handoff') actions.push(`Handed off from ${entry.pieceName} to ${entry.receiverName}`);
    if (entry.kind === 'pass') actions.push(`Passed from ${entry.pieceName} to ${entry.receiverName}`);
    if (entry.kind === 'block') actions.push(`${entry.isBlitz ? 'Blitzed' : 'Blocked'} ${entry.receiverName} with ${entry.pieceName}`);
    index += 1;
  }
  return actions;
}
