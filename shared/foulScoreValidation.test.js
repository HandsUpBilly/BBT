import test from 'node:test';
import assert from 'node:assert/strict';
import { foulOdds } from './foulMath.js';
import { validateScoreSubmission, ScoreValidationError } from './scoreValidation.js';

const injury = foulOdds({ av: 9 });
const move = {
  foul: true, pieceName: 'Fouler', pieceRole: 'lineman', receiverName: 'Victim',
  receiverRole: 'blocker', from: { col: 7, row: 10 }, to: { col: 7, row: 9 },
  av: 9, offensiveAssists: 0, defensiveAssists: 0,
  dirtyPlayer: false, sneakyGit: false, loneFouler: false, stunty: false,
  armourBreakProbability: injury.armourBreakProbability,
  sendOffProbability: injury.sentOffProbability,
  actionProb: injury.injuryProbability, cumulativeProb: injury.injuryProbability,
};
const submission = {
  name: 'Tester', probability: injury.injuryProbability, diceCount: 1,
  moves: [move],
};
test('accepts and preserves mathematically sound foul score', () => {
  const valid = validateScoreSubmission(submission, null);
  assert.equal(valid.moves[0].foul, true);
  assert.ok(Math.abs(valid.moves[0].armourBreakProbability - injury.armourBreakProbability) < 1e-12);
});
test('rejects fabricated foul injury probability', () => {
  assert.throws(() => validateScoreSubmission({
    ...submission, probability: 0.5, moves: [{ ...move, actionProb: 0.5 }],
  }, null), ScoreValidationError);
});
test('rejects armour-break probability substituted for casualty chance', () => {
  assert.throws(() => validateScoreSubmission({
    ...submission, probability: injury.armourBreakProbability,
    moves: [{ ...move, actionProb: injury.armourBreakProbability }],
  }, null), ScoreValidationError);
});
test('rejects more than one foul in the same turn', () => {
  assert.throws(() => validateScoreSubmission({
    ...submission, probability: injury.injuryProbability ** 2,
    diceCount: 2, moves: [move, move],
  }, null), ScoreValidationError);
});
test('checks branch segment probability against original foul dice', () => {
  assert.throws(() => validateScoreSubmission({
    ...submission,
    tree: { lineProb: 0.9, moves: [{ ...move, actionProb: 0.9 }], outcome: 'scored' },
    probability: 0.9, diceCount: 0,
  }, null), ScoreValidationError);
});
