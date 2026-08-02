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

test('a verified Google name overrides the supplied one and names are capped', () => {
  const score = validateScoreSubmission(
    { name: 'Impostor', probability: 1, diceCount: 0, moves: [] },
    { name: 'Verified Coach' },
  );
  assert.equal(score.name, 'Verified Coach');

  const long = validateScoreSubmission({ name: 'x'.repeat(200), probability: 1, diceCount: 0, moves: [] });
  assert.equal(long.name.length, 32);

  assert.throws(
    () => validateScoreSubmission({ name: '   ', probability: 1, diceCount: 0, moves: [] }),
    /name is required/,
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
