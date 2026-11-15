import type { Objective } from './types';

const OBJECTIVE_TEXT: Record<Objective, string> = {
  touchdown: 'Score a touchdown this turn.',
  'crowd-surf': 'Push an opposing player into the crowd this turn.',
  'injure-by-foul': 'Injure an opposing player with a foul this turn.',
};

export function puzzleObjectiveText(objective: Objective = 'touchdown'): string {
  return OBJECTIVE_TEXT[objective];
}

/** Shared player-facing explanation of how every puzzle is scored. */
export const OBJECTIVE_GUIDANCE =
  "Find the sequence of moves with the highest probability of meeting the puzzle's stated objective.";
