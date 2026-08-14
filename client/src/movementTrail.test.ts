import { describe, expect, it } from 'vitest';
import { buildMovementStartMarkers } from './movementTrail';
import { key } from './bfs';
import type { MoveLogEntry } from './types';

function move(overrides: Partial<MoveLogEntry>): MoveLogEntry {
  return {
    kind: 'move',
    pieceName: 'Aldric Swiftfoot',
    pieceRole: 'blocker',
    from: { col: 0, row: 0 },
    to: { col: 0, row: 1 },
    steps: 1,
    dodgeTarget: null,
    isGfi: false,
    actionProb: 1,
    cumulativeProb: 1,
    ...overrides,
  };
}

describe('buildMovementStartMarkers', () => {
  it('numbers each piece by the order it first moves', () => {
    const actionLog = [
      move({ pieceName: 'Aldric', from: { col: 2, row: 3 }, to: { col: 2, row: 4 } }),
      move({ pieceName: 'Aldric', from: { col: 2, row: 4 }, to: { col: 2, row: 5 } }),
      move({ pieceName: 'Brogar', from: { col: 5, row: 3 }, to: { col: 5, row: 4 } }),
    ];

    const markers = buildMovementStartMarkers(actionLog);

    expect(markers.get(key({ col: 2, row: 3 }))).toBe(1);
    expect(markers.get(key({ col: 5, row: 3 }))).toBe(2);
    // Only the piece's very first starting square is marked.
    expect(markers.get(key({ col: 2, row: 4 }))).toBeUndefined();
    expect(markers.size).toBe(2);
  });

  it('keeps one number per piece across a restarted route', () => {
    // Aldric moves, does something else, then moves again from a new square —
    // this is still one activation-order number for Aldric, not two.
    const actionLog = [
      move({ pieceName: 'Aldric', from: { col: 2, row: 3 }, to: { col: 2, row: 4 } }),
      move({ pieceName: 'Aldric', from: { col: 6, row: 6 }, to: { col: 6, row: 7 } }),
    ];

    const markers = buildMovementStartMarkers(actionLog);

    expect(markers.get(key({ col: 2, row: 3 }))).toBe(1);
    expect(markers.get(key({ col: 6, row: 6 }))).toBeUndefined();
    expect(markers.size).toBe(1);
  });

  it('ignores non-move entries', () => {
    const actionLog = [
      { kind: 'handoff' } as unknown as MoveLogEntry,
      move({ pieceName: 'Aldric', from: { col: 1, row: 1 }, to: { col: 1, row: 2 } }),
    ];

    const markers = buildMovementStartMarkers(actionLog);

    expect(markers.get(key({ col: 1, row: 1 }))).toBe(1);
    expect(markers.size).toBe(1);
  });
});
