import { describe, expect, it } from 'vitest';
import { buildMovementTrailMap, trailPolylinePoints } from './movementTrail';
import { passTrajectoryPath } from './passTrajectory';
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
      terminal: false,
      leadsToTerminal: false,
    }]);
    expect(trails.get('7,9')).toEqual([{
      from: { col: 7, row: 8 },
      to: { col: 7, row: 10 },
      terminal: false,
      leadsToTerminal: true,
    }]);
    expect(trails.get('7,10')).toEqual([{
      from: { col: 7, row: 9 },
      to: null,
      terminal: true,
      leadsToTerminal: false,
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

/**
 * The trail geometry has to transpose with the board. Landscape draws state
 * rows across the screen; portrait draws state cols across. Hardcoded to
 * either one, half the trails point ninety degrees away from the route they
 * describe — and a wrong trail still looks like a plausible trail, so nothing
 * else would catch it.
 */
describe('trailPolylinePoints', () => {
  const here = { col: 7, row: 9 };

  it('draws a row-to-row run horizontally in landscape', () => {
    const trail = { from: { col: 7, row: 8 }, to: { col: 7, row: 10 } };
    expect(trailPolylinePoints(trail, here.col, here.row, false))
      .toBe('0,50 50,50 100,50');
  });

  it('draws the same run vertically in portrait', () => {
    const trail = { from: { col: 7, row: 8 }, to: { col: 7, row: 10 } };
    expect(trailPolylinePoints(trail, here.col, here.row, true))
      .toBe('50,0 50,50 50,100');
  });

  it('draws a col-to-col run vertically in landscape', () => {
    const trail = { from: { col: 6, row: 9 }, to: { col: 8, row: 9 } };
    expect(trailPolylinePoints(trail, here.col, here.row, false))
      .toBe('50,0 50,50 50,100');
  });

  it('draws the same run horizontally in portrait', () => {
    const trail = { from: { col: 6, row: 9 }, to: { col: 8, row: 9 } };
    expect(trailPolylinePoints(trail, here.col, here.row, true))
      .toBe('0,50 50,50 100,50');
  });

  it('stops at the centre where a route ends', () => {
    const trail = { from: { col: 7, row: 8 }, to: null };
    expect(trailPolylinePoints(trail, here.col, here.row, false))
      .toBe('0,50 50,50 50,50');
    expect(trailPolylinePoints(trail, here.col, here.row, true))
      .toBe('50,0 50,50 50,50');
  });

  it('handles a diagonal step in both orientations', () => {
    const trail = { from: { col: 6, row: 8 }, to: { col: 8, row: 10 } };
    // Symmetric on the diagonal, so the corner coordinates match; what
    // differs is which neighbour each end actually points at.
    expect(trailPolylinePoints(trail, here.col, here.row, false))
      .toBe('0,0 50,50 100,100');
    expect(trailPolylinePoints(trail, here.col, here.row, true))
      .toBe('0,0 50,50 100,100');
  });
});

describe('passTrajectoryPath', () => {
  it('draws a curved quadratic throw in landscape orientation', () => {
    expect(passTrajectoryPath(
      { col: 7, row: 8 },
      { col: 7, row: 12 },
      false,
      0,
      0,
    )).toBe('M 8.5 7.5 Q 10.5 8.22 12.5 7.5');
  });

  it('transposes the same throw in portrait orientation', () => {
    expect(passTrajectoryPath(
      { col: 7, row: 8 },
      { col: 7, row: 12 },
      true,
      0,
      0,
    )).toBe('M 7.5 8.5 Q 6.78 10.5 7.5 12.5');
  });
});
