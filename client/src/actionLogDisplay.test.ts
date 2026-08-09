import { describe, expect, it } from 'vitest';
import { compactDisplayLog, entryHasRoll, rollCount } from './actionLogDisplay';
import type { MoveLogEntry } from './types';

function step(
  from: [number, number],
  to: [number, number],
  overrides: Partial<MoveLogEntry> = {},
): MoveLogEntry {
  return {
    kind: 'move',
    pieceName: 'Runner',
    pieceRole: 'catcher',
    from: { col: from[0], row: from[1] },
    to: { col: to[0], row: to[1] },
    steps: 1,
    dodgeTarget: null,
    isGfi: false,
    actionProb: 1,
    cumulativeProb: 1,
    ...overrides,
  };
}

describe('compactDisplayLog', () => {
  it('folds a straight unbroken walk into one line', () => {
    const compacted = compactDisplayLog([
      step([7, 8], [7, 9]),
      step([7, 9], [7, 10]),
      step([7, 10], [7, 11]),
    ]);

    expect(compacted).toHaveLength(1);
    const folded = compacted[0];
    expect(folded.kind).toBe('move');
    if (folded.kind !== 'move') return;
    expect(folded.steps).toBe(3);
    expect(folded.to).toEqual({ col: 7, row: 11 });
  });

  it('does not fold a change of direction', () => {
    const compacted = compactDisplayLog([
      step([7, 8], [7, 9]),
      step([7, 9], [8, 9]),
    ]);
    expect(compacted).toHaveLength(2);
  });

  it('keeps both Go For It rushes when they run back to back', () => {
    // The regression. Every roll-bearing step used to report a null direction,
    // so two of them compared equal and merged — and the merge kept only the
    // first entry's roll fields, so one GFI silently left the log.
    const compacted = compactDisplayLog([
      step([7, 8], [7, 9], { isGfi: true, actionProb: 5 / 6, cumulativeProb: 5 / 6 }),
      step([7, 9], [7, 10], { isGfi: true, actionProb: 5 / 6, cumulativeProb: 25 / 36 }),
    ]);

    expect(compacted).toHaveLength(2);
    expect(compacted.every(e => e.kind === 'move' && e.isGfi)).toBe(true);
  });

  it('keeps consecutive dodges', () => {
    const compacted = compactDisplayLog([
      step([7, 8], [7, 9], { dodgeTarget: 4, actionProb: 3 / 6 }),
      step([7, 9], [7, 10], { dodgeTarget: 3, actionProb: 4 / 6 }),
    ]);

    expect(compacted).toHaveLength(2);
    expect(compacted.map(e => (e.kind === 'move' ? e.dodgeTarget : null))).toEqual([4, 3]);
  });

  it('keeps a plain step next to a rolled one', () => {
    const compacted = compactDisplayLog([
      step([7, 8], [7, 9]),
      step([7, 9], [7, 10], { isGfi: true }),
      step([7, 10], [7, 11]),
    ]);
    expect(compacted).toHaveLength(3);
  });

  it('does not fold across a gap or a change of piece', () => {
    const other = step([7, 9], [7, 10], { pieceName: 'Second Runner' });
    expect(compactDisplayLog([step([7, 8], [7, 9]), other])).toHaveLength(2);
    // Non-contiguous: the second step does not start where the first ended.
    expect(compactDisplayLog([step([7, 8], [7, 9]), step([2, 2], [2, 3])])).toHaveLength(2);
  });

  it('carries the final cumulative probability onto the folded entry', () => {
    const compacted = compactDisplayLog([
      step([7, 8], [7, 9], { cumulativeProb: 0.9 }),
      step([7, 9], [7, 10], { cumulativeProb: 0.8 }),
    ]);
    expect(compacted[0].cumulativeProb).toBe(0.8);
  });
});

describe('entryHasRoll', () => {
  it('is false for a plain step', () => {
    expect(entryHasRoll(step([7, 8], [7, 9]))).toBe(false);
  });

  it('is true for GFI, dodge and pickup steps', () => {
    expect(entryHasRoll(step([7, 8], [7, 9], { isGfi: true }))).toBe(true);
    expect(entryHasRoll(step([7, 8], [7, 9], { dodgeTarget: 4 }))).toBe(true);
    expect(entryHasRoll(step([7, 8], [7, 9], { pickupTarget: 3 }))).toBe(true);
  });
});

describe('rollCount', () => {
  it('counts only the steps that actually rolled', () => {
    expect(rollCount([
      step([7, 8], [7, 9]),
      step([7, 9], [7, 10], { isGfi: true }),
      step([7, 10], [7, 11], { dodgeTarget: 4 }),
      step([7, 11], [7, 12]),
    ])).toBe(2);
  });
});
