import { describe, expect, it } from 'vitest';
import { buildMovementTrailMap } from './movementTrail';
import type { MoveLogEntry } from './types';

function move(fromRow: number, toRow: number): MoveLogEntry {
  return {
    kind: 'move',
    pieceName: 'Runner',
    pieceRole: 'catcher',
    from: { col: 7, row: fromRow },
    to: { col: 7, row: toRow },
    steps: 1,
    dodgeTarget: null,
    isGfi: false,
    actionProb: 1,
    cumulativeProb: 1,
  };
}

describe('buildMovementTrailMap', () => {
  it('keeps the full committed route from its origin after activation state is cleared', () => {
    const trails = buildMovementTrailMap([move(8, 9), move(9, 10)]);

    expect([...trails.keys()]).toEqual(['7,8', '7,9', '7,10']);
    expect(trails.get('7,8')).toEqual([{
      from: { col: 7, row: 8 },
      to: { col: 7, row: 9 },
    }]);
    expect(trails.get('7,9')).toEqual([{
      from: { col: 7, row: 8 },
      to: { col: 7, row: 10 },
    }]);
    expect(trails.get('7,10')).toEqual([{
      from: { col: 7, row: 9 },
      to: null,
    }]);
  });

  it('keeps separate trails when routes overlap', () => {
    const secondRunner = move(8, 9);
    secondRunner.pieceName = 'Second Runner';

    const trails = buildMovementTrailMap([move(8, 9), secondRunner]);

    expect(trails.get('7,8')).toHaveLength(2);
    expect(trails.get('7,9')).toHaveLength(2);
  });
});
