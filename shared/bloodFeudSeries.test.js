import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeScenario, validateScenario, seriesMembershipErrors } from './scenarioValidation.js';

const readJson = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const series = readJson('client/src/series/blood-feud.json');
const puzzles = series.scenarioIds.map(id => readJson(`client/src/scenarios/${id}.json`));

test('Blood Feud consists of twelve uniquely identified single-objective puzzles', () => {
  assert.equal(puzzles.length, 12);
  assert.equal(new Set(series.scenarioIds).size, 12);
  assert.deepEqual(series.teams, ['human', 'black-orc']);
  assert.equal(series.logo, 'blood-feud');
  assert.equal(puzzles.filter(p => p.objective === 'crowd-surf').length, 3);
  assert.equal(puzzles.filter(p => p.objective === 'touchdown').length, 9);
  assert.deepEqual(seriesMembershipErrors(series, [series], puzzles), []);
});

test('every Blood Feud puzzle passes the shared production scenario validator', () => {
  for (const raw of puzzles) {
    const normalized = normalizeScenario(raw);
    assert.deepEqual(validateScenario(normalized), [], `${raw.id} failed validation`);
    assert.equal(raw.published, true, `${raw.id} should be playable`);
    assert.equal(raw.freePlay, false, `${raw.id} should stay in its series`);
  }
});

function pushArc(attacker, defender) {
  const dx = Math.sign(defender.col - attacker.col);
  const dy = Math.sign(defender.row - attacker.row);
  const offsets = dx && dy ? [[dx, dy], [dx, 0], [0, dy]]
    : dx ? [[dx, 0], [dx, -1], [dx, 1]]
      : [[0, dy], [-1, dy], [1, dy]];
  return offsets.map(([x, y]) => ({ col: defender.col + x, row: defender.row + y }));
}

test('each crowd-surf puzzle includes an unactivated legal surf opportunity', () => {
  for (const puzzle of puzzles.filter(p => p.objective === 'crowd-surf')) {
    const allies = puzzle.pieces.filter(p => p.team === puzzle.activeTeam);
    const enemies = puzzle.pieces.filter(p => p.team !== puzzle.activeTeam);
    const possible = allies.some(ally => enemies.some(enemy => {
      const distance = Math.max(
        Math.abs(ally.position.col - enemy.position.col),
        Math.abs(ally.position.row - enemy.position.row),
      );
      return distance === 1 && pushArc(ally.position, enemy.position).some(target =>
        target.col < 0 || target.col >= 15 || target.row < 0 || target.row >= 26);
    }));
    assert.ok(possible, `${puzzle.id}: no immediate surf geometry; include a documented blitz witness if changed`);
  }
});
