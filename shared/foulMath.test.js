import test from 'node:test';
import assert from 'node:assert/strict';
import { foulOdds } from './foulMath.js';

test('unmodified AV 10+ casualty probability: 6/36 armour, 6/36 injury', () => {
  const odds = foulOdds({ av: 9 });
  assert.ok(Math.abs(odds.armourBreakProbability - 6/36) < 1e-12);
  assert.ok(Math.abs(odds.injuryProbability - 1/36) < 1e-12);
  assert.ok(odds.sentOffProbability > 0);
});
test('one offensive assist increases injury odds; defensive assist reduces them', () => {
  const a = foulOdds({ av: 9 });
  assert.ok(foulOdds({ av: 9, offensiveAssists: 1 }).injuryProbability > a.injuryProbability);
  assert.ok(foulOdds({ av: 9, defensiveAssists: 1 }).injuryProbability < a.injuryProbability);
});
test('Dirty Player can rescue armour or an injury after the roll', () => {
  assert.ok(foulOdds({ av: 9, dirtyPlayer: true }).injuryProbability > foulOdds({ av: 9 }).injuryProbability);
});
test('Stunty counts nine as casualty; KO is not counted', () => {
  const normal = foulOdds({ av: 9 });
  assert.ok(foulOdds({ av: 9, stunty: true }).injuryProbability > normal.injuryProbability);
  assert.ok(normal.injuryProbability < normal.armourBreakProbability);
});
test('Sneaky Git removes only unbroken-armour doubles from send-offs', () => {
  const a = foulOdds({ av: 9 });
  const b = foulOdds({ av: 9, sneakyGit: true });
  assert.ok(b.sentOffProbability < a.sentOffProbability);
  assert.ok(Math.abs(b.injuryProbability - a.injuryProbability) < 1e-12);
});
test('Lone Fouler rerolls failed armour only when unassisted', () => {
  const a = foulOdds({ av: 9 });
  assert.ok(foulOdds({ av: 9, loneFouler: true }).injuryProbability > a.injuryProbability);
  assert.ok(Math.abs(foulOdds({ av: 9, offensiveAssists: 1, loneFouler: true }).injuryProbability
    - foulOdds({ av: 9, offensiveAssists: 1 }).injuryProbability) < 1e-12);
});
test('invalid armour/assist inputs are rejected', () => {
  assert.throws(() => foulOdds({ av: 99 }));
  assert.throws(() => foulOdds({ av: 9, offensiveAssists: -1 }));
});
