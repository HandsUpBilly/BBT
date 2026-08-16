import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ScoreValidationError,
  sortEntries,
  upsertPersonalBest,
  validateScoreSubmission,
  validateSeriesSubmission,
} from './scoreValidation.js';

const moves = [
  { actionProb: 5 / 6, cumulativeProb: 5 / 6 },
  { actionProb: 4 / 6, cumulativeProb: (5 / 6) * (4 / 6) },
];
const probability = (5 / 6) * (4 / 6);

test('accepts a self-consistent submission', () => {
  const score = validateScoreSubmission({ name: 'Coach', probability, diceCount: 2, moves });
  assert.equal(score.name, 'Coach');
  assert.equal(score.diceCount, 2);
  assert.equal(score.moves.length, 2);
});

test('rejects a claimed probability its own move list does not support', () => {
  // diceCount disagrees with the number of moves.
  assert.throws(
    () => validateScoreSubmission({ name: 'Cheat', probability: 1, diceCount: 0, moves }),
    ScoreValidationError,
  );
  // diceCount agrees, but the product of the moves does not equal the claim.
  assert.throws(
    () => validateScoreSubmission({ name: 'Cheat', probability: 1, diceCount: 2, moves }),
    /does not match its recorded rolls/,
  );
});

test('a clean run must claim probability 1', () => {
  assert.deepEqual(
    validateScoreSubmission({ name: 'Coach', probability: 1, diceCount: 0, moves: [] }).moves,
    [],
  );
  assert.throws(
    () => validateScoreSubmission({ name: 'Coach', probability: 0.5, diceCount: 0, moves: [] }),
    /must be 1 when no dice were rolled/,
  );
});

test('DOCUMENTED GAP: a forged clean run is indistinguishable from a real one', () => {
  // Walking to the end zone with no rolls is a legitimate 100% solution on some
  // scenarios, so this payload cannot be rejected without a rules-engine replay.
  // Asserted deliberately so the limitation is visible rather than assumed away.
  const forged = validateScoreSubmission({ name: 'Cheat', probability: 1, diceCount: 0, moves: [] });
  assert.equal(forged.probability, 1);
});

test('keeps NaN, Infinity, and out-of-range values out of the sort key', () => {
  for (const bad of [NaN, Infinity, -1, 0, 1.5, 'abc', null]) {
    assert.throws(
      () => validateScoreSubmission({ name: 'Coach', probability: bad, diceCount: 0, moves: [] }),
      ScoreValidationError,
      `probability ${String(bad)} should be rejected`,
    );
  }
  assert.throws(
    () => validateScoreSubmission({ name: 'Coach', probability: 1, diceCount: -3, moves: [] }),
    ScoreValidationError,
  );
});

test('keeps the supplied public alias for a signed-in player and caps names', () => {
  const score = validateScoreSubmission(
    { name: 'Impostor', probability: 1, diceCount: 0, moves: [] },
    { name: 'Verified Coach' },
  );
  assert.equal(score.name, 'Impostor');

  const long = validateScoreSubmission({ name: 'x'.repeat(200), probability: 1, diceCount: 0, moves: [] });
  assert.equal(long.name.length, 32);

  assert.throws(
    () => validateScoreSubmission({ name: '   ', probability: 1, diceCount: 0, moves: [] }),
    /name is required/,
  );
});

test('sanitizes a move down to whitelisted fields, discarding everything else', () => {
  const move = {
    actionProb: 0.5,
    cumulativeProb: 0.5,
    pieceName: 'Aldric Swiftfoot',
    pieceRole: 'thrower',
    receiverName: 'Sera Quickhand',
    receiverRole: 'catcher',
    from: { col: 7, row: 10 },
    to: { col: 7, row: 9 },
    dodgeTarget: 3,
    dodgeSkillReroll: true,
    isGfi: false,
    pickupTarget: 2,
    catchTarget: 4,
    passTarget: 3,
    rangeBand: 'short',
    isBlitz: true,
    diceCount: 2,
    picker: 'attacker',
    acceptedFaces: ['push', 'defender-down'],
    resolvedFace: 'defender-down',
    // Not part of RiskyMove at all — must not survive sanitization.
    maliciousPayload: 'x'.repeat(50_000),
  };

  const score = validateScoreSubmission({ name: 'Coach', probability: 0.5, diceCount: 1, moves: [move] });
  const [sanitized] = score.moves;

  assert.deepEqual(Object.keys(sanitized).sort(), [
    'acceptedFaces', 'actionProb', 'catchTarget', 'cumulativeProb', 'diceCount', 'dodgeSkillReroll', 'dodgeTarget',
    'from', 'isBlitz', 'isGfi', 'passTarget', 'pickupTarget', 'pieceName', 'pieceRole', 'picker',
    'rangeBand', 'receiverName', 'receiverRole', 'resolvedFace', 'to',
  ].sort());
  assert.equal(sanitized.pieceName, 'Aldric Swiftfoot');
  assert.deepEqual(sanitized.from, { col: 7, row: 10 });
  assert.deepEqual(sanitized.acceptedFaces, ['push', 'defender-down']);
  assert.equal(sanitized.resolvedFace, 'defender-down');
  assert.equal(sanitized.dodgeSkillReroll, true);
  assert.equal('maliciousPayload' in sanitized, false);
});

test('sanitizes a move with junk/out-of-range field values rather than trusting them', () => {
  const move = {
    actionProb: 1,
    pieceName: 'y'.repeat(500),
    from: { col: 'not-a-number', row: null },
    dodgeTarget: 99,
    catchTarget: -5,
    rangeBand: 'not-a-real-band',
    diceCount: 7,
    picker: 'referee',
    resolvedFace: 'coin-flip',
    acceptedFaces: 'not-an-array',
    cumulativeProb: -3,
  };

  const score = validateScoreSubmission({ name: 'Coach', probability: 1, diceCount: 1, moves: [move] });
  const [sanitized] = score.moves;

  assert.equal(sanitized.pieceName.length, 40);
  assert.deepEqual(sanitized.from, { col: 0, row: 0 });
  assert.equal(sanitized.dodgeTarget, null);
  assert.equal('catchTarget' in sanitized, false);
  assert.equal('rangeBand' in sanitized, false);
  assert.equal('diceCount' in sanitized, false);
  assert.equal('picker' in sanitized, false);
  assert.equal('resolvedFace' in sanitized, false);
  assert.equal('acceptedFaces' in sanitized, false);
  // Invalid cumulativeProb falls back to the validated actionProb.
  assert.equal(sanitized.cumulativeProb, 1);
});

test('sanitizes the saved play log used by ranking diagrams', () => {
  const playLog = [{
    kind: 'move',
    pieceName: 'Runner'.repeat(20),
    pieceRole: 'not persisted',
    from: { col: 7, row: 6 },
    to: { col: 99, row: -4 },
    actionProb: 1,
    maliciousPayload: 'x'.repeat(50_000),
  }, {
    kind: 'block',
    pieceName: 'Blitzer',
    receiverName: 'Defender',
    from: { col: 7, row: 8 },
    to: { col: 6, row: 9 },
    isBlitz: true,
    diceCount: 2,
  }];

  const score = validateScoreSubmission({
    name: 'Coach', probability: 1, diceCount: 0, moves: [], playLog,
  });

  assert.deepEqual(score.playLog, [{
    kind: 'move',
    pieceName: 'Runner'.repeat(20).slice(0, 40),
    from: { col: 7, row: 6 },
    to: { col: 0, row: 0 },
  }, {
    kind: 'block',
    pieceName: 'Blitzer',
    receiverName: 'Defender',
    from: { col: 7, row: 8 },
    to: { col: 6, row: 9 },
    isBlitz: true,
    diceCount: 2,
  }]);
});

test('keeps play-log storage bounded and rejects unknown action kinds', () => {
  const base = { name: 'Coach', probability: 1, diceCount: 0, moves: [] };
  assert.throws(
    () => validateScoreSubmission({ ...base, playLog: 'not-an-array' }),
    /playLog must be an array/,
  );
  assert.throws(
    () => validateScoreSubmission({ ...base, playLog: Array.from({ length: 251 }, () => ({
      kind: 'move', pieceName: 'Runner', from: { col: 1, row: 1 }, to: { col: 1, row: 2 },
    })) }),
    /playLog has too many entries/,
  );
  assert.throws(
    () => validateScoreSubmission({ ...base, playLog: [{ kind: 'teleport' }] }),
    /playLog contains an invalid entry/,
  );
});

test('series submissions must average their puzzles and total their dice', () => {
  const puzzles = [
    { scenarioId: 'a', scenarioName: 'A', probability: 0.5, diceCount: 1, moves: [{ actionProb: 0.5 }] },
    { scenarioId: 'b', scenarioName: 'B', probability: 1, diceCount: 0, moves: [] },
  ];
  const entry = validateSeriesSubmission({ name: 'Coach', probability: 0.75, diceCount: 1, puzzles });
  assert.equal(entry.puzzles.length, 2);

  assert.throws(
    () => validateSeriesSubmission({ name: 'Coach', probability: 0.99, diceCount: 1, puzzles }),
    /average of its puzzle probabilities/,
  );
  assert.throws(
    () => validateSeriesSubmission({ name: 'Coach', probability: 0.75, diceCount: 9, puzzles }),
    /total across its puzzles/,
  );
  assert.throws(
    () => validateSeriesSubmission({ name: 'Coach', probability: 1, diceCount: 0, puzzles: [] }),
    /must include its puzzle results/,
  );
});

test('upsertPersonalBest never lets a worse run destroy a better one', () => {
  const best = { id: '1', userId: 'u1', probability: 0.9, diceCount: 2 };
  const worse = { id: '2', userId: 'u1', probability: 0.4, diceCount: 1 };
  const better = { id: '3', userId: 'u1', probability: 0.95, diceCount: 3 };
  const matches = e => e.userId === 'u1';

  assert.deepEqual(upsertPersonalBest([best], worse, matches), [best]);
  assert.deepEqual(upsertPersonalBest([best], better, matches), [better]);
  assert.deepEqual(upsertPersonalBest([], best, matches), [best]);
});

test('an equal probability with fewer dice counts as better', () => {
  const existing = { id: '1', userId: 'u1', probability: 0.5, diceCount: 4 };
  const tighter = { id: '2', userId: 'u1', probability: 0.5, diceCount: 2 };
  const looser = { id: '3', userId: 'u1', probability: 0.5, diceCount: 9 };
  const matches = e => e.userId === 'u1';

  assert.deepEqual(upsertPersonalBest([existing], tighter, matches), [tighter]);
  assert.deepEqual(upsertPersonalBest([existing], looser, matches), [existing]);
});

test('sortEntries ranks by probability then fewest dice, without mutating', () => {
  const entries = [
    { id: 'a', probability: 0.5, diceCount: 1 },
    { id: 'b', probability: 0.9, diceCount: 4 },
    { id: 'c', probability: 0.9, diceCount: 2 },
  ];
  const snapshot = [...entries];
  assert.deepEqual(sortEntries(entries).map(e => e.id), ['c', 'b', 'a']);
  assert.deepEqual(entries, snapshot, 'sortEntries must not mutate its input');
});

// ── Branch-tree submissions ─────────────────────────────────────────────────
//
// The canonical shape: a block with an attacker who has Block, against a plain
// defender. Five faces collapse to three live boards weighted 2/6, 1/6, 2/6,
// with one face putting the attacker down and ending the drive.

function branchBlock(children, overrides = {}) {
  return {
    lineProb: 1,
    moves: [],
    outcome: 'block',
    block: {
      diceCount: 1,
      picker: 'attacker',
      faceCounts: [2, 1, 2],
      deadFaceCount: 1,
      children,
      ...overrides,
    },
  };
}

const scoredLeaf = (lineProb = 1) => ({ lineProb, moves: [], outcome: 'scored' });
const concededLeaf = () => ({ lineProb: 1, moves: [], outcome: 'conceded' });

function treeBody(tree, probability, diceCount, extra = {}) {
  return { name: 'Coach', probability, diceCount, tree, ...extra };
}

test('accepts a branch tree whose score matches its branches', () => {
  const tree = branchBlock([scoredLeaf(), scoredLeaf(), scoredLeaf()]);
  const result = validateScoreSubmission(treeBody(tree, 5 / 6, 1));

  assert.equal(result.branching, true);
  assert.ok(Math.abs(result.probability - 5 / 6) < 1e-9);
  assert.equal(result.diceCount, 1);
});

test('charges a conceded branch its full weight', () => {
  // Giving up the 2/6 "pushed" branch leaves 3/6 scoring.
  const tree = branchBlock([scoredLeaf(), scoredLeaf(), concededLeaf()]);
  const result = validateScoreSubmission(treeBody(tree, 3 / 6, 1));

  assert.ok(Math.abs(result.probability - 0.5) < 1e-9);
});

test('rejects a branch tree whose claimed probability is inflated', () => {
  const tree = branchBlock([scoredLeaf(), scoredLeaf(), concededLeaf()]);
  assert.throws(
    () => validateScoreSubmission(treeBody(tree, 0.95, 1)),
    /does not match its branch tree/,
  );
});

test('rejects a block whose faces do not add up to a die', () => {
  // Dropping the face that puts the attacker down would claim the whole die
  // scores — the exact edit that makes a bad run look clean.
  const tree = branchBlock([scoredLeaf(), scoredLeaf(), scoredLeaf()], { deadFaceCount: 0 });
  assert.throws(() => validateScoreSubmission(treeBody(tree, 1, 1)), /faces must add up to 6/);
});

test('rejects a block missing a branch for one of its board states', () => {
  const tree = branchBlock([scoredLeaf(), scoredLeaf()]);
  assert.throws(
    () => validateScoreSubmission(treeBody(tree, 5 / 6, 1)),
    /one branch per board state/,
  );
});

test('rejects a segment whose rolls do not multiply to its probability', () => {
  const tree = branchBlock([
    { lineProb: 0.5, moves: [{ actionProb: 5 / 6 }], outcome: 'scored' },
    scoredLeaf(),
    scoredLeaf(),
  ]);
  assert.throws(
    () => validateScoreSubmission(treeBody(tree, 0.7, 1)),
    /segment probability does not match its recorded rolls/,
  );
});

test('rejects a tree that scores nowhere', () => {
  const tree = branchBlock([concededLeaf(), concededLeaf(), concededLeaf()]);
  assert.throws(() => validateScoreSubmission(treeBody(tree, 0.5, 1)), /must score somewhere/);
});

test('rejects a branch that both ends and continues', () => {
  const tree = branchBlock([
    { ...scoredLeaf(), block: branchBlock([scoredLeaf(), scoredLeaf(), scoredLeaf()]).block },
    scoredLeaf(),
    scoredLeaf(),
  ]);
  assert.throws(
    () => validateScoreSubmission(treeBody(tree, 5 / 6, 1)),
    /cannot both end and continue/,
  );
});

test('rejects an unknown branch outcome', () => {
  const tree = branchBlock([{ lineProb: 1, moves: [], outcome: 'maybe' }, scoredLeaf(), scoredLeaf()]);
  assert.throws(() => validateScoreSubmission(treeBody(tree, 5 / 6, 1)), /unknown outcome/);
});

test('rejects a branch tree nested past the depth cap', () => {
  let tree = scoredLeaf();
  for (let i = 0; i < 20; i++) tree = branchBlock([tree, scoredLeaf(), scoredLeaf()]);
  assert.throws(() => validateScoreSubmission(treeBody(tree, 0.5, 1)), /too many nodes|nested too deeply/);
});

test('accepts a fractional dice count and rejects one that disagrees', () => {
  // One branch takes a second block, so the mean over scoring lines sits
  // between one die and two.
  const inner = branchBlock([scoredLeaf(), scoredLeaf(), scoredLeaf()]);
  const tree = branchBlock([inner, scoredLeaf(), scoredLeaf()]);

  // The 2/6 branch carries a second block worth 5/6; the other 3/6 score flat.
  const probability = (2 / 6) * (5 / 6) + 3 / 6;
  // Two dice on the scoring lines under the inner block, one on the rest.
  const dice = ((2 / 6) * (5 / 6) * 2 + (3 / 6) * 1) / probability;
  assert.ok(!Number.isInteger(dice), 'the fixture should produce a fractional dice count');

  const result = validateScoreSubmission(treeBody(tree, probability, dice));
  assert.ok(Math.abs(result.diceCount - dice) < 1e-9);
  assert.throws(() => validateScoreSubmission(treeBody(tree, probability, 9)), /diceCount does not match/);
});

test('series submissions validate Parallel Universe trees and fractional dice totals', () => {
  const inner = branchBlock([scoredLeaf(), scoredLeaf(), scoredLeaf()]);
  const tree = branchBlock([inner, scoredLeaf(), scoredLeaf()]);
  const treeProbability = (2 / 6) * (5 / 6) + 3 / 6;
  const treeDice = ((2 / 6) * (5 / 6) * 2 + (3 / 6)) / treeProbability;
  const puzzles = [
    { scenarioId: 'a', scenarioName: 'Clean', probability: 1, diceCount: 0, moves: [] },
    {
      scenarioId: 'b', scenarioName: 'Universes', probability: treeProbability,
      diceCount: treeDice, moves: [], tree,
    },
  ];
  const result = validateSeriesSubmission({
    name: 'Coach',
    probability: (1 + treeProbability) / 2,
    diceCount: treeDice,
    puzzles,
  });

  assert.equal(result.puzzles[1].branching, true);
  assert.ok(Math.abs(result.diceCount - treeDice) < 1e-9);
  assert.throws(
    () => validateSeriesSubmission({
      name: 'Coach', probability: (1 + treeProbability) / 2,
      diceCount: treeDice, puzzles: [{ ...puzzles[1], probability: 0.99 }],
    }),
    /does not match its branch tree/,
  );
});

test('keeps a branching run primary-line moves for display without a product check', () => {
  const tree = branchBlock([scoredLeaf(), scoredLeaf(), scoredLeaf()]);
  const result = validateScoreSubmission(treeBody(tree, 5 / 6, 1, {
    moves: [{ actionProb: 0.5, pieceName: 'Aldric', from: { col: 1, row: 1 }, to: { col: 1, row: 2 } }],
  }));

  // 0.5 is nothing like the 5/6 score; under branching that is expected,
  // because these rolls are only part of one branch.
  assert.equal(result.moves.length, 1);
  assert.equal(result.moves[0].pieceName, 'Aldric');
});
