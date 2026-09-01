import { describe, it, expect } from 'vitest';
import {
  key,
  fromKey,
  neighbours,
  computeReachable,
  findShortestPath,
  dodgeTargetAt,
  pickupTargetAt,
  catchTargetAt,
  rangeBandForPass,
  rangeModifier,
  passTargetAt,
  computePassRange,
  blockDiceCount,
  blockCombinedProbability,
  blockOutcomeProbabilities,
  countEligibleAssists,
  pushBackCandidates,
} from './bfs';
import type { Position } from './types';

const at = (col: number, row: number): Position => ({ col, row });

describe('grid basics', () => {
  it('round-trips a position through its key', () => {
    expect(fromKey(key(at(7, 12)))).toEqual(at(7, 12));
  });

  it('clips neighbours at the pitch edges', () => {
    expect(neighbours(at(0, 0))).toHaveLength(3);   // corner
    expect(neighbours(at(14, 25))).toHaveLength(3); // opposite corner
    expect(neighbours(at(7, 12))).toHaveLength(8);  // open field
    expect(neighbours(at(0, 12))).toHaveLength(5);  // edge
  });
});

describe('findShortestPath', () => {
  it('takes the diagonal — Chebyshev distance, not Manhattan', () => {
    const path = findShortestPath(at(5, 5), at(8, 8), 6, [], []);
    expect(path).not.toBeNull();
    expect(path).toHaveLength(3);
    expect(path!.at(-1)!.pos).toEqual(at(8, 8));
  });

  it('returns null when the target is out of range', () => {
    expect(findShortestPath(at(5, 5), at(5, 20), 3, [], [])).toBeNull();
  });

  it('returns null when the target square is occupied', () => {
    expect(findShortestPath(at(5, 5), at(5, 6), 6, [at(5, 6)], [])).toBeNull();
  });

  it('returns an empty path when already on the target', () => {
    expect(findShortestPath(at(5, 5), at(5, 5), 6, [], [])).toEqual([]);
  });

  it('routes around a blocker rather than through it', () => {
    const path = findShortestPath(at(5, 5), at(5, 7), 6, [at(5, 6)], []);
    expect(path).not.toBeNull();
    expect(path!.some(step => step.pos.col === 5 && step.pos.row === 6)).toBe(false);
    expect(path!.at(-1)!.pos).toEqual(at(5, 7));
  });

  it('spends MA before GFI, and marks the GFI steps', () => {
    // MA 2 + 2 GFI covers exactly 4 squares.
    const path = findShortestPath(at(5, 5), at(5, 9), 2, [], [], 3, 2);
    expect(path).toHaveLength(4);
    expect(path!.map(s => s.isGfi)).toEqual([false, false, true, true]);
    // One more square than MA + GFI is unreachable.
    expect(findShortestPath(at(5, 5), at(5, 10), 2, [], [], 3, 2)).toBeNull();
  });

  it('flags the step that leaves a tackle zone as a dodge', () => {
    const orc = at(5, 6);
    const path = findShortestPath(at(5, 5), at(5, 4), 6, [orc], [orc]);
    expect(path).not.toBeNull();
    // The mover starts inside the orc's tackle zone, so leaving costs a dodge.
    expect(path![0].requiresDodge).toBe(true);
    expect(path![0].dodgeTarget).toBe(3); // 6 - AG3, no TZ on the destination
  });

  it('annotates the step that lands on the loose ball with a pickup roll', () => {
    const path = findShortestPath(at(5, 5), at(5, 7), 6, [], [], 3, 0, at(5, 6));
    expect(path).not.toBeNull();
    expect(path![0].pickupTarget).toBe(3);
    expect(path![1].pickupTarget).toBeNull();
  });

  it('prefers the straight line among equal-length paths', () => {
    const path = findShortestPath(at(5, 5), at(9, 5), 6, [], []);
    expect(path!.map(s => s.pos.row)).toEqual([5, 5, 5, 5]);
  });
});

describe('computeReachable', () => {
  it('covers a full MA radius and excludes the origin', () => {
    const { reachableKeys } = computeReachable(at(7, 12), 1, [], []);
    expect(reachableKeys.size).toBe(8);
    expect(reachableKeys.has(key(at(7, 12)))).toBe(false);
  });

  it('never routes through an occupied square', () => {
    const { reachableKeys } = computeReachable(at(7, 12), 1, [at(7, 11)], []);
    expect(reachableKeys.has(key(at(7, 11)))).toBe(false);
    expect(reachableKeys.size).toBe(7);
  });

  it('extends the radius by the available GFI steps', () => {
    const withoutGfi = computeReachable(at(7, 12), 1, [], []).reachableKeys.size;
    const withGfi = computeReachable(at(7, 12), 1, [], [], 2).reachableKeys.size;
    expect(withGfi).toBeGreaterThan(withoutGfi);
  });

  it('splits free and dodge squares around an opponent', () => {
    const orc = at(7, 11);
    const { free, dodge } = computeReachable(at(7, 12), 2, [orc], [orc]);
    // Standing in the orc's tackle zone, every first step is a dodge.
    expect(dodge.length).toBeGreaterThan(0);
    expect(free.every(p => key(p) !== key(orc))).toBe(true);
  });
});

describe('roll targets', () => {
  it('derives dodge and pickup targets from AG plus tackle zones', () => {
    expect(dodgeTargetAt(at(5, 5), 3, [])).toBe(3);
    expect(dodgeTargetAt(at(5, 5), 4, [])).toBe(2);
    expect(dodgeTargetAt(at(5, 5), 3, [at(5, 6)])).toBe(4);
    // Two covering tackle zones stack.
    expect(dodgeTargetAt(at(5, 5), 3, [at(5, 6), at(6, 5)])).toBe(5);
    expect(pickupTargetAt(at(5, 5), 3, [])).toBe(3);
  });

  it('clamps every target into the 2–6 band', () => {
    expect(dodgeTargetAt(at(5, 5), 6, [])).toBe(2);
    expect(dodgeTargetAt(at(5, 5), 1, [at(5, 6), at(6, 5), at(4, 5)])).toBe(6);
  });

  it('gives a catch the accurate-pass bonus', () => {
    // 6 - AG3 - 1 = 2+
    expect(catchTargetAt(at(5, 5), 3, [])).toBe(2);
    expect(catchTargetAt(at(5, 5), 3, [at(5, 6)])).toBe(3);
  });
});

describe('passing', () => {
  it('bands distances off the BB2025 range ruler', () => {
    expect(rangeBandForPass(at(5, 5), at(5, 5))).toBeNull(); // own square
    expect(rangeBandForPass(at(5, 5), at(5, 7))).toBe('quick');
    expect(rangeBandForPass(at(5, 5), at(5, 10))).toBe('short');
    expect(rangeBandForPass(at(5, 5), at(5, 13))).toBe('long');
    expect(rangeBandForPass(at(5, 5), at(5, 17))).toBe('bomb');
  });

  it('is symmetrical in both axes', () => {
    expect(rangeBandForPass(at(5, 5), at(5, 12))).toBe(rangeBandForPass(at(5, 12), at(5, 5)));
    expect(rangeBandForPass(at(2, 5), at(9, 5))).toBe(rangeBandForPass(at(5, 2), at(5, 9)));
  });

  it('returns null beyond the table', () => {
    expect(rangeBandForPass(at(0, 0), at(14, 25))).toBeNull();
  });

  it('penalizes range and tackle zones on the passer', () => {
    expect(rangeModifier('quick')).toBe(0);
    expect(rangeModifier('bomb')).toBe(3);
    // PA3, quick pass, no pressure.
    expect(passTargetAt(at(5, 5), 3, at(5, 7), [])).toBe(3);
    // Same throw with an opponent marking the passer.
    expect(passTargetAt(at(5, 5), 3, at(5, 7), [at(4, 4)])).toBe(4);
    // Long range adds +2.
    expect(passTargetAt(at(5, 5), 3, at(5, 13), [])).toBe(5);
    // Out of range at all.
    expect(passTargetAt(at(0, 0), 3, at(14, 25), [])).toBeNull();
  });

  it('maps every in-range square once', () => {
    const range = computePassRange(at(7, 12));
    expect(range.get(key(at(7, 14)))).toBe('quick');
    expect(range.has(key(at(7, 12)))).toBe(false); // the passer's own square
    expect(range.size).toBeGreaterThan(0);
  });
});

describe('block dice', () => {
  it('picks dice count and picker from effective strength', () => {
    expect(blockDiceCount(3, 0, 3, 0)).toEqual({ diceCount: 1, picker: 'attacker' });
    expect(blockDiceCount(4, 0, 3, 0)).toEqual({ diceCount: 2, picker: 'attacker' });
    expect(blockDiceCount(3, 0, 4, 0)).toEqual({ diceCount: 2, picker: 'defender' });
    expect(blockDiceCount(7, 0, 3, 0)).toEqual({ diceCount: 3, picker: 'attacker' });
    expect(blockDiceCount(3, 0, 7, 0)).toEqual({ diceCount: 3, picker: 'defender' });
    // Exactly double is not *more* than double.
    expect(blockDiceCount(6, 0, 3, 0)).toEqual({ diceCount: 2, picker: 'attacker' });
    // Assists count toward effective strength.
    expect(blockDiceCount(3, 1, 3, 0)).toEqual({ diceCount: 2, picker: 'attacker' });
  });

  it('combines face probabilities per who picks', () => {
    // Push is 2 of 6 faces.
    expect(blockCombinedProbability(['push'], 1, 'attacker')).toBeCloseTo(2 / 6, 10);
    expect(blockCombinedProbability(['push'], 2, 'attacker')).toBeCloseTo(1 - (4 / 6) ** 2, 10);
    expect(blockCombinedProbability(['push'], 2, 'defender')).toBeCloseTo((2 / 6) ** 2, 10);
    // Accepting every face is a certainty for the attacker.
    expect(blockCombinedProbability(
      ['attacker-down', 'both-down', 'push', 'defender-stumbles', 'defender-down'], 2, 'attacker',
    )).toBeCloseTo(1, 10);
  });

  it('reports each face in isolation', () => {
    const probs = blockOutcomeProbabilities(1, 'attacker');
    expect(probs.push).toBeCloseTo(2 / 6, 10);
    expect(probs['defender-down']).toBeCloseTo(1 / 6, 10);
    // The five faces cover all six physical sides.
    const total = Object.values(probs).reduce((sum, p) => sum + p, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('counts only unmarked standing teammates adjacent to the opposing block player', () => {
    const teammates = [
      { id: 'self', position: at(5, 6) },
      { id: 'near', position: at(6, 5) },
      { id: 'downed', position: at(4, 5), down: true },
      { id: 'near-own-player-only', position: at(5, 7) },
      { id: 'far', position: at(1, 1) },
    ];
    const opponents = [
      { id: 'block-opponent', position: at(5, 5) },
      { id: 'marker', position: at(7, 5) },
    ];

    expect(countEligibleAssists(at(5, 5), teammates, 'self', opponents, 'block-opponent')).toBe(0);
    expect(countEligibleAssists(
      at(5, 5),
      teammates,
      'self',
      opponents.map(opponent => opponent.id === 'marker' ? { ...opponent, down: true } : opponent),
      'block-opponent',
    )).toBe(1);
  });
});

describe('push-back candidates', () => {
  it('offers the straight-back square and its two flanks', () => {
    const squares = pushBackCandidates(at(5, 6), at(5, 5), [at(5, 6), at(5, 5)]);
    expect(squares).toHaveLength(3);
    expect(squares).toContainEqual(at(5, 4));
    expect(squares).toContainEqual(at(4, 4));
    expect(squares).toContainEqual(at(6, 4));
  });

  it('pushes along the diagonal for a diagonal hit', () => {
    const squares = pushBackCandidates(at(4, 6), at(5, 5), [at(4, 6), at(5, 5)]);
    expect(squares).toContainEqual(at(6, 4));
    expect(squares).toContainEqual(at(6, 5));
    expect(squares).toContainEqual(at(5, 4));
  });

  it('drops occupied and off-pitch squares', () => {
    const blocked = pushBackCandidates(at(5, 6), at(5, 5), [at(5, 6), at(5, 5), at(5, 4)]);
    expect(blocked).not.toContainEqual(at(5, 4));

    // Defender on the top edge: every push square would be off the pitch.
    const offPitch = pushBackCandidates(at(5, 1), at(5, 0), [at(5, 1), at(5, 0)]);
    expect(offPitch).toHaveLength(0);
  });

  it('offers occupied players only when every immediate push square is occupied', () => {
    const positions = [
      at(5, 6), at(5, 5),
      at(5, 4), at(4, 4), at(6, 4),
    ];
    const squares = pushBackCandidates(at(5, 6), at(5, 5), positions);

    expect(squares).toHaveLength(3);
    expect(squares).toContainEqual(at(5, 4));
    expect(squares).toContainEqual(at(4, 4));
    expect(squares).toContainEqual(at(6, 4));
  });

  it('does not offer an occupied route that can never reach empty turf', () => {
    const solidPitch = Array.from({ length: 15 * 26 }, (_, index) =>
      at(index % 15, Math.floor(index / 15)),
    );
    const squares = pushBackCandidates(at(5, 2), at(5, 1), solidPitch);

    expect(squares).toHaveLength(0);
  });
});
