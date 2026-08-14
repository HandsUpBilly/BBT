import { describe, expect, it } from 'vitest';
import { blockCombinedProbability, BLOCK_FACE_WEIGHTS } from './bfs';
import type { BlockOutcomeFace } from './types';
import {
  blockBoardStates,
  blockNodeValue,
  blockStateProbabilities,
  type BlockBoardStateKind,
  type BlockResolution,
} from './blockBranching';

const DICE_COUNTS = [1, 2, 3] as const;
const PICKERS = ['attacker', 'defender'] as const;

function kinds(resolution: BlockResolution): BlockBoardStateKind[] {
  return resolution.states.map(s => s.kind);
}

function faceCountOf(resolution: BlockResolution, kind: BlockBoardStateKind): number {
  return resolution.states.find(s => s.kind === kind)?.faceCount ?? 0;
}

describe('blockBoardStates — faces collapse into boards', () => {
  it('gives the canonical Block-vs-plain block three live states and one dead face', () => {
    const resolution = blockBoardStates(['Block'], []);

    expect(kinds(resolution)).toEqual([
      'defender-pushed-down',   // Defender Stumbles + Defender Down
      'defender-down-in-place', // Both Down, attacker keeps their feet
      'defender-pushed',        // Push Back
    ]);
    expect(faceCountOf(resolution, 'defender-pushed-down')).toBe(2);
    expect(faceCountOf(resolution, 'defender-down-in-place')).toBe(1);
    expect(faceCountOf(resolution, 'defender-pushed')).toBe(2);
    expect(resolution.deadFaceCount).toBe(1);

    const live = resolution.states.reduce((sum, s) => sum + s.faceCount, 0);
    expect(live / 6).toBeCloseTo(5 / 6, 12);
  });

  it('separates the two down states by whether the square is vacated', () => {
    const resolution = blockBoardStates(['Block'], []);
    const pushedDown = resolution.states.find(s => s.kind === 'defender-pushed-down');
    const inPlace = resolution.states.find(s => s.kind === 'defender-down-in-place');

    // This is the distinction the old face checklist could not express: both
    // remove the tackle zone, only one clears the square.
    expect(pushedDown).toMatchObject({ defenderPushed: true, defenderFalls: true });
    expect(inPlace).toMatchObject({ defenderPushed: false, defenderFalls: true });
  });

  it('merges Defender Stumbles into Push Back when the defender has Dodge', () => {
    const resolution = blockBoardStates(['Block'], ['Dodge']);

    expect(faceCountOf(resolution, 'defender-pushed')).toBe(3); // Push ×2 + Stumbles
    expect(faceCountOf(resolution, 'defender-pushed-down')).toBe(1); // Defender Down only
  });

  it('cancels that Dodge downgrade when the attacker has Tackle', () => {
    const resolution = blockBoardStates(['Block', 'Tackle'], ['Dodge']);

    expect(faceCountOf(resolution, 'defender-pushed')).toBe(2);
    expect(faceCountOf(resolution, 'defender-pushed-down')).toBe(2);
  });

  it('makes Both Down a no-op board when both players have Block', () => {
    const resolution = blockBoardStates(['Block'], ['Block']);
    const noEffect = resolution.states.find(s => s.kind === 'no-effect');

    expect(noEffect).toMatchObject({ faceCount: 1, defenderPushed: false, defenderFalls: false });
    expect(resolution.deadFaceCount).toBe(1);
  });

  it('kills Both Down outright when the attacker has no Block', () => {
    const resolution = blockBoardStates([], []);

    expect(resolution.deadFaceCount).toBe(2); // Attacker Down + Both Down
    expect(kinds(resolution)).not.toContain('defender-down-in-place');
    expect(kinds(resolution)).not.toContain('no-effect');
  });

  it('treats Wrestle without Block as a turnover, since the attacker goes prone too', () => {
    expect(blockBoardStates(['Wrestle'], []).deadFaceCount).toBe(2);
    expect(blockBoardStates(['Wrestle'], ['Block']).deadFaceCount).toBe(2);
    // Block wins over Wrestle when a player somehow has both.
    expect(blockBoardStates(['Wrestle', 'Block'], []).deadFaceCount).toBe(1);
  });
});

describe('blockStateProbabilities — weights are exhaustive', () => {
  const skillSets: Array<[string[], string[], string]> = [
    [['Block'], [], 'Block vs plain'],
    [['Block'], ['Dodge'], 'Block vs Dodge'],
    [['Block', 'Tackle'], ['Dodge'], 'Block+Tackle vs Dodge'],
    [['Block'], ['Block'], 'Block vs Block'],
    [[], [], 'plain vs plain'],
  ];

  for (const [attacker, defender, label] of skillSets) {
    for (const diceCount of DICE_COUNTS) {
      for (const picker of PICKERS) {
        it(`sums live + dead to exactly 1 (${label}, ${diceCount}d, ${picker} picks)`, () => {
          const resolution = blockBoardStates(attacker, defender);
          const values = resolution.states.map((_, i) => (i + 1) / 10);
          const { probabilities, deadProbability } = blockStateProbabilities(
            resolution, values, diceCount, picker,
          );

          const total = probabilities.reduce((a, b) => a + b, 0) + deadProbability;
          expect(total).toBeCloseTo(1, 12);
          expect(probabilities.every(p => p >= 0)).toBe(true);
        });
      }
    }
  }
});

describe('blockStateProbabilities — reproduces the shipped checklist formula', () => {
  const skillSets: Array<[string[], string[], string]> = [
    [['Block'], [], 'Block vs plain'],
    [['Block'], ['Dodge'], 'Block vs Dodge'],
    [['Block'], ['Block'], 'Block vs Block'],
    [[], [], 'plain vs plain'],
  ];

  // Binary values are the old model: 1 for states you would have ticked, 0 for
  // the rest. Every subset of states must land on blockCombinedProbability of
  // the faces those states own — including the empty and full subsets.
  for (const [attacker, defender, label] of skillSets) {
    it(`matches blockCombinedProbability for every state subset (${label})`, () => {
      const resolution = blockBoardStates(attacker, defender);
      const stateCount = resolution.states.length;

      for (let mask = 0; mask < (1 << stateCount); mask++) {
        const chosen = resolution.states.filter((_, i) => (mask >> i) & 1);
        const acceptedFaces: BlockOutcomeFace[] = chosen.flatMap(s => s.faces);
        const values = resolution.states.map((_, i) => ((mask >> i) & 1 ? 1 : 0));

        // Sanity: the collapse preserved the die's face weighting.
        const chosenFaces = chosen.reduce((sum, s) => sum + s.faceCount, 0);
        expect(acceptedFaces.reduce((sum, f) => sum + BLOCK_FACE_WEIGHTS[f], 0)).toBe(chosenFaces);

        for (const diceCount of DICE_COUNTS) {
          for (const picker of PICKERS) {
            const expected = blockCombinedProbability(acceptedFaces, diceCount, picker);
            const actual = blockNodeValue(resolution, values, diceCount, picker);
            expect(actual).toBeCloseTo(expected, 12);
          }
        }
      }
    });
  }
});

describe('blockStateProbabilities — the picker is a decision, not a chance node', () => {
  const resolution = blockBoardStates(['Block'], []);
  const index = (kind: BlockBoardStateKind) => resolution.states.findIndex(s => s.kind === kind);

  it('ranks states by what they are worth, best first', () => {
    const values = resolution.states.map(s => (s.kind === 'defender-pushed' ? 1 : 0.2));
    const { order } = blockStateProbabilities(resolution, values, 2, 'attacker');

    expect(order[0]).toBe(index('defender-pushed'));
  });

  it('shifts weight onto a branch as that branch becomes more valuable', () => {
    const pushed = index('defender-pushed');
    const pushedDown = index('defender-pushed-down');
    const inPlace = index('defender-down-in-place');

    // Distinct values throughout: with ties the split between equally good
    // states is arbitrary, so comparing one of them across runs proves nothing.
    const pushWeak = resolution.states.map((_, i) =>
      i === pushedDown ? 1 : i === inPlace ? 0.5 : 0.1);
    const pushStrong = resolution.states.map((_, i) =>
      i === pushedDown ? 1 : i === inPlace ? 0.5 : 0.9);

    const before = blockStateProbabilities(resolution, pushWeak, 2, 'attacker');
    const after = blockStateProbabilities(resolution, pushStrong, 2, 'attacker');

    // Authoring a decent continuation for Push means the attacker would now
    // sometimes take that die instead, so Push overtakes the in-place knockdown
    // and gains weight at its expense — neither branch's contents changed.
    expect(after.probabilities[pushed]).toBeGreaterThan(before.probabilities[pushed]);
    expect(after.probabilities[inPlace]).toBeLessThan(before.probabilities[inPlace]);
    expect(blockNodeValue(resolution, pushStrong, 2, 'attacker'))
      .toBeGreaterThan(blockNodeValue(resolution, pushWeak, 2, 'attacker'));
  });

  it('never takes weight off the best branch to feed a lesser one', () => {
    const pushed = index('defender-pushed');
    const pushedDown = index('defender-pushed-down');

    // Improving a branch can only draw weight from the branches it overtakes,
    // so the attacker's first choice is untouched by anything below it.
    const before = blockStateProbabilities(
      resolution, resolution.states.map((_, i) => (i === pushedDown ? 1 : 0)), 2, 'attacker',
    );
    const after = blockStateProbabilities(
      resolution, resolution.states.map((_, i) => (i === pushedDown ? 1 : i === pushed ? 0.9 : 0)), 2, 'attacker',
    );

    expect(after.probabilities[pushedDown]).toBeCloseTo(before.probabilities[pushedDown], 12);
    expect(after.probabilities[pushed]).toBeGreaterThan(before.probabilities[pushed]);
  });

  it('hands the worst state to the attacker when the defender picks', () => {
    const pushed = index('defender-pushed');
    const values = resolution.states.map((_, i) => (i === pushed ? 1 : 0));

    const attackerPicks = blockStateProbabilities(resolution, values, 2, 'attacker');
    const defenderPicks = blockStateProbabilities(resolution, values, 2, 'defender');

    expect(defenderPicks.probabilities[pushed]).toBeLessThan(attackerPicks.probabilities[pushed]);
    // Two dice in the defender's hands: only both showing Push gets it through.
    expect(defenderPicks.probabilities[pushed]).toBeCloseTo((2 / 6) ** 2, 12);
  });

  it('is unaffected by extra dice when every live state is equally good', () => {
    const values = resolution.states.map(() => 1);

    for (const diceCount of DICE_COUNTS) {
      // Nothing to choose between, so the only question is whether the attacker
      // stays up: 5/6 with one die, better with two in the attacker's hands.
      const value = blockNodeValue(resolution, values, diceCount, 'attacker');
      expect(value).toBeCloseTo(1 - (1 / 6) ** diceCount, 12);
    }
  });

  it('treats a missing value as a conceded branch worth nothing', () => {
    const full = blockNodeValue(resolution, [1, 1, 1], 1, 'attacker');
    const short = blockNodeValue(resolution, [1, 1], 1, 'attacker');

    expect(full).toBeCloseTo(5 / 6, 12);
    expect(short).toBeCloseTo(3 / 6, 12); // pushed-down (2) + down-in-place (1)
  });
});
