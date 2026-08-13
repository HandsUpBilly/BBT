import { describe, it, expect } from 'vitest';
import { dodgeChance, pathPreviewProb, successChance } from './useGameState';
import type { PathStep } from './bfs';

function step(overrides: Partial<PathStep> = {}): PathStep {
  return {
    pos: { col: 7, row: 10 },
    requiresDodge: false,
    dodgeTarget: null,
    isGfi: false,
    pickupTarget: null,
    ...overrides,
  };
}

/**
 * The commit bar states these odds to the player before asking them to accept
 * a move, so it has to agree with what handleSquareClick will actually record.
 */
describe('pathPreviewProb', () => {
  it('is certain for a path with no rolls', () => {
    expect(pathPreviewProb([step(), step()])).toBe(1);
  });

  it('is certain for an empty path', () => {
    expect(pathPreviewProb([])).toBe(1);
  });

  it('scores a Go For It as a 2+', () => {
    expect(pathPreviewProb([step({ isGfi: true })])).toBeCloseTo(5 / 6, 10);
  });

  it('scores a dodge at its target number', () => {
    expect(pathPreviewProb([step({ requiresDodge: true, dodgeTarget: 4 })]))
      .toBeCloseTo(successChance(4), 10);
  });

  it('multiplies rolls across separate squares', () => {
    const path = [
      step({ requiresDodge: true, dodgeTarget: 3 }),
      step({ requiresDodge: true, dodgeTarget: 5 }),
    ];
    expect(pathPreviewProb(path)).toBeCloseTo((4 / 6) * (2 / 6), 10);
  });

  it('models one Dodge skill reroll across the whole path', () => {
    const path = [
      step({ requiresDodge: true, dodgeTarget: 3 }),
      step({ requiresDodge: true, dodgeTarget: 2 }),
    ];

    // Base success plus either one of the two dodges failing once and then
    // succeeding on its skill reroll: p1*p2*(1 + q1 + q2).
    expect(pathPreviewProb(path, 1)).toBeCloseTo((4 / 6) * (5 / 6) * (1 + 2 / 6 + 1 / 6), 10);
  });

  it('carries a partially consumed reroll into the next preview', () => {
    const firstDodge = dodgeChance(3, 1);
    expect(firstDodge.chance).toBeCloseTo(8 / 9, 10);
    expect(firstDodge.nextAvailability).toBeCloseTo(3 / 4, 10);

    expect(pathPreviewProb([
      step({ requiresDodge: true, dodgeTarget: 2 }),
    ], firstDodge.nextAvailability)).toBeCloseTo(15 / 16, 10);
  });

  it('stacks a GFI, a dodge and a pickup landing on one square', () => {
    // The rules let all three apply to the same step, and handleSquareClick
    // multiplies them — this is the case most likely to drift apart.
    const path = [step({ isGfi: true, requiresDodge: true, dodgeTarget: 4, pickupTarget: 3 })];
    expect(pathPreviewProb(path)).toBeCloseTo((5 / 6) * (3 / 6) * (4 / 6), 10);
  });

  it('ignores a dodge target that is present without requiresDodge', () => {
    // findShortestPath only sets dodgeTarget alongside requiresDodge, but the
    // commit path keys off dodgeTarget alone, so both must behave the same.
    expect(pathPreviewProb([step({ dodgeTarget: 4 })])).toBeCloseTo(successChance(4), 10);
  });
});
