import { describe, expect, it } from 'vitest';
import { tutorialActionSequence } from './tutorialRecap';
import type { ActionLogEntry } from './types';

describe('tutorialActionSequence', () => {
  it('groups movement steps and neutrally names tactical actions', () => {
    const move = (toRow: number): ActionLogEntry => ({
      kind: 'move', pieceName: 'Sera', pieceRole: 'catcher',
      from: { col: 7, row: toRow + 1 }, to: { col: 7, row: toRow }, steps: 1,
      dodgeTarget: null, isGfi: false, actionProb: 1, cumulativeProb: 1,
    });
    const log: ActionLogEntry[] = [move(9), move(8), {
      kind: 'handoff', pieceName: 'Aldric', pieceRole: 'thrower', receiverName: 'Sera', receiverRole: 'catcher',
      from: { col: 7, row: 10 }, to: { col: 7, row: 9 }, catchTarget: 3,
      actionProb: 2 / 3, cumulativeProb: 2 / 3, dodgeTarget: null, isGfi: false,
    }];
    expect(tutorialActionSequence(log)).toEqual([
      'Moved Sera 2 squares',
      'Handed off from Aldric to Sera',
    ]);
  });
});
