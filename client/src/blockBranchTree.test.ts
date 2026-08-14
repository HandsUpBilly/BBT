import { describe, expect, it } from 'vitest';
import { blockBoardStates, type BlockResolution } from './blockBranching';
import {
  branchLineIds,
  branchSummary,
  branchValue,
  concededLine,
  findLine,
  openLine,
  replaceLine,
  scoredLine,
  type LineNode,
} from './blockBranchTree';

const BLOCK_VS_PLAIN = blockBoardStates(['Block'], []);

/** Index of a board state within a resolution, by kind. */
function stateIndex(resolution: BlockResolution, kind: string): number {
  return resolution.states.findIndex(s => s.kind === kind);
}

function blockLine(
  id: string,
  children: (LineNode | undefined)[],
  opts: { lineProb?: number; diceCount?: 1 | 2 | 3; picker?: 'attacker' | 'defender' } = {},
): LineNode {
  return {
    id,
    lineProb: opts.lineProb ?? 1,
    lineDice: opts.diceCount ?? 1,
    outcome: {
      kind: 'block',
      block: {
        resolution: BLOCK_VS_PLAIN,
        diceCount: opts.diceCount ?? 1,
        picker: opts.picker ?? 'attacker',
        children,
      },
    },
  };
}

describe('branchValue', () => {
  it('scores a straight line as the product of its rolls', () => {
    expect(branchValue(scoredLine('root', 0.75))).toBeCloseTo(0.75, 12);
  });

  it('treats open and conceded lines as worth nothing', () => {
    expect(branchValue(openLine('root', 0.9))).toBe(0);
    expect(branchValue(concededLine('root', 0.9))).toBe(0);
    expect(branchValue(undefined)).toBe(0);
  });

  it('folds a block into the expected value across its board states', () => {
    // Every branch scores outright, so the only loss is the attacker falling.
    const tree = blockLine('root', BLOCK_VS_PLAIN.states.map((_, i) => scoredLine(`s${i}`)));
    expect(branchValue(tree)).toBeCloseTo(5 / 6, 12);
  });

  it('charges a conceded branch its full weight', () => {
    const pushed = stateIndex(BLOCK_VS_PLAIN, 'defender-pushed');
    const tree = blockLine(
      'root',
      BLOCK_VS_PLAIN.states.map((_, i) => (i === pushed ? concededLine(`s${i}`) : scoredLine(`s${i}`))),
    );
    // Push is 2 of 6 faces and is now worth nothing, on top of the dead face.
    expect(branchValue(tree)).toBeCloseTo(3 / 6, 12);
  });

  it('multiplies the segment rolls through the block below them', () => {
    const tree = blockLine('root', BLOCK_VS_PLAIN.states.map((_, i) => scoredLine(`s${i}`, 0.5)), {
      lineProb: 0.8,
    });
    expect(branchValue(tree)).toBeCloseTo(0.8 * (5 / 6) * 0.5, 12);
  });

  it('handles a block inside a block', () => {
    const inner = blockLine('inner', BLOCK_VS_PLAIN.states.map((_, i) => scoredLine(`i${i}`)));
    const outer = blockLine('root', BLOCK_VS_PLAIN.states.map((_, i) =>
      (i === 0 ? inner : scoredLine(`o${i}`))));

    // The first branch now carries a second block rather than an outright score.
    const values = BLOCK_VS_PLAIN.states.map((_, i) => (i === 0 ? 5 / 6 : 1));
    const expected = BLOCK_VS_PLAIN.states.reduce(
      (sum, state, i) => sum + (state.faceCount / 6) * values[i], 0,
    );
    expect(branchValue(outer)).toBeCloseTo(expected, 12);
  });
});

describe('branchSummary', () => {
  it('accounts for every scrap of probability', () => {
    const pushed = stateIndex(BLOCK_VS_PLAIN, 'defender-pushed');
    const tree = blockLine(
      'root',
      BLOCK_VS_PLAIN.states.map((_, i) =>
        i === pushed ? openLine(`s${i}`, 0.9) : scoredLine(`s${i}`, 0.7)),
      { lineProb: 0.85 },
    );

    const { score, deadWeight, failedRollWeight, unresolvedWeight } = branchSummary(tree);
    expect(score + deadWeight + failedRollWeight + unresolvedWeight).toBeCloseTo(1, 12);
  });

  it('reports the score as the summed weight of the lines that scored', () => {
    const tree = blockLine('root', BLOCK_VS_PLAIN.states.map((_, i) => scoredLine(`s${i}`, 0.6)), {
      lineProb: 0.9,
    });

    const summary = branchSummary(tree);
    const scoredWeight = summary.lines
      .filter(line => line.outcomeKind === 'scored')
      .reduce((sum, line) => sum + line.weight, 0);

    // The two definitions of the score have to agree, or the model is incoherent.
    expect(scoredWeight).toBeCloseTo(summary.score, 12);
  });

  it('splits weight across branches in proportion to the derived ordering', () => {
    const tree = blockLine('root', BLOCK_VS_PLAIN.states.map((_, i) => scoredLine(`s${i}`)));
    const summary = branchSummary(tree);

    for (const [i, state] of BLOCK_VS_PLAIN.states.entries()) {
      const line = summary.lines.find(l => l.id === `s${i}`);
      // One die, nothing to choose between: weights are just the face counts.
      expect(line?.weight).toBeCloseTo(state.faceCount / 6, 12);
    }
  });

  it('attributes the dead face to the block, not to a failed roll', () => {
    const tree = blockLine('root', BLOCK_VS_PLAIN.states.map((_, i) => scoredLine(`s${i}`)));
    const summary = branchSummary(tree);

    expect(summary.deadWeight).toBeCloseTo(1 / 6, 12);
    expect(summary.failedRollWeight).toBeCloseTo(0, 12);
  });

  it('attributes a failed dodge to the rolls, not to the block', () => {
    const tree = scoredLine('root', 0.75);
    const summary = branchSummary(tree);

    expect(summary.failedRollWeight).toBeCloseTo(0.25, 12);
    expect(summary.deadWeight).toBeCloseTo(0, 12);
  });

  it('leaves unauthored branches sitting in unresolved weight', () => {
    const tree = blockLine('root', [scoredLine('s0'), undefined, undefined]);
    const summary = branchSummary(tree);

    // A missing child is conceded, so its weight is neither scored nor dead —
    // it is exactly the mass the branch strip needs to nag about.
    expect(summary.score).toBeCloseTo(2 / 6, 12);
    expect(summary.deadWeight).toBeCloseTo(1 / 6, 12);
    expect(summary.score + summary.deadWeight + summary.unresolvedWeight).toBeCloseTo(1, 12);
  });

  it('reports expected dice as a weighted mean over the lines that scored', () => {
    // Root block (1 die) where one branch takes a second block (1 die) and the
    // rest score immediately.
    const inner = blockLine('inner', BLOCK_VS_PLAIN.states.map((_, i) => scoredLine(`i${i}`)));
    const tree = blockLine('root', BLOCK_VS_PLAIN.states.map((_, i) =>
      (i === 0 ? inner : scoredLine(`o${i}`))));

    const summary = branchSummary(tree);
    // Lines under `inner` rolled 2 dice; the others rolled 1. Both are above 1
    // and below 2, and the mean has to sit between them.
    expect(summary.expectedDice).toBeGreaterThan(1);
    expect(summary.expectedDice).toBeLessThan(2);
  });

  it('reports no expected dice for a line that cannot score', () => {
    expect(branchSummary(concededLine('root')).expectedDice).toBe(0);
  });
});

describe('tree editing', () => {
  const tree = blockLine('root', [scoredLine('a'), openLine('b'), concededLine('c')]);

  it('lists every line depth-first', () => {
    expect(branchLineIds(tree)).toEqual(['root', 'a', 'b', 'c']);
  });

  it('finds a line by id and reports a miss', () => {
    expect(findLine(tree, 'b')?.outcome.kind).toBe('open');
    expect(findLine(tree, 'nope')).toBeUndefined();
  });

  it('replaces a line without disturbing its siblings', () => {
    const next = replaceLine(tree, 'b', scoredLine('b'));

    expect(findLine(next, 'b')?.outcome.kind).toBe('scored');
    expect(findLine(next, 'a')).toBe(findLine(tree, 'a'));
    expect(branchValue(next)).toBeGreaterThan(branchValue(tree));
  });

  it('returns the same tree when the id is not present', () => {
    expect(replaceLine(tree, 'nope', scoredLine('nope'))).toBe(tree);
  });

  it('replaces the root itself', () => {
    expect(replaceLine(tree, 'root', scoredLine('root')).outcome.kind).toBe('scored');
  });
});
