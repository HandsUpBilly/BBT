import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeScenario, validateScenario, seriesMembershipErrors } from './scenarioValidation.js';

const readJson = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const series = readJson('client/src/series/blood-feud.json');
const second = readJson('client/src/series/troll-toll.json');
const lineups = [second, series];
const loadPuzzles = ids => ids.map(id => readJson(`client/src/scenarios/${id}.json`));
const allPuzzles = loadPuzzles(lineups.flatMap(item => item.scenarioIds));
const puzzles = allPuzzles.filter(puzzle => puzzle.id.startsWith('blood-feud-'));

test('The Troll Toll and Blood Feud each have eight puzzles with no shared membership', () => {
  assert.deepEqual(lineups.map(item => item.scenarioIds.length), [8, 8]);
  assert.equal(new Set(allPuzzles.map(puzzle => puzzle.id)).size, 16);
  for (const item of lineups) {
    assert.deepEqual(seriesMembershipErrors(item, lineups, allPuzzles), []);
    const objectives = loadPuzzles(item.scenarioIds).map(puzzle => puzzle.objective);
    assert.equal(objectives.filter(objective => objective === 'touchdown').length, 6);
    assert.equal(objectives.filter(objective => objective === 'crowd-surf').length, 2);
  }
});

test('All twelve Blood Feud boards remain in the two series', () => {
  assert.equal(puzzles.length, 12);
  assert.deepEqual(series.teams, ['human', 'black-orc']);
  assert.equal(series.logo, 'blood-feud');
  assert.equal(puzzles.filter(p => p.objective === 'crowd-surf').length, 3);
  assert.equal(puzzles.filter(p => p.objective === 'touchdown').length, 9);
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

test('every touchdown has at least two geometrically distinct carrier routes', () => {
  for (const puzzle of puzzles.filter(p => p.objective === 'touchdown')) {
    const carrier = puzzle.pieces.find(p => p.hasBall && p.team === puzzle.activeTeam);
    assert.ok(carrier, `${puzzle.id}: no ball carrier on active team`);
    const goal = puzzle.activeTeam === 'human' ? 0 : 25;
    const blocked = new Set(puzzle.pieces.filter(p => p.id !== carrier.id)
      .map(p => `${p.position.col},${p.position.row}`));
    const canFinish = (startCol, startRow) => {
      const queue = [[startCol, startRow, 1]], seen = new Set();
      while (queue.length) {
        const [col, row, steps] = queue.shift();
        const key = `${col},${row}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (row === goal) return true;
        if (steps >= carrier.ma + 2) continue;
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
          if (!dx && !dy) continue;
          const x = col + dx, y = row + dy;
          if (x >= 0 && x < 15 && y >= 0 && y < 26 && !blocked.has(`${x},${y}`))
            queue.push([x, y, steps + 1]);
        }
      }
      return false;
    };
    const firstSteps = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const col = carrier.position.col + dx, row = carrier.position.row + dy;
      if (col < 0 || col > 14 || row < 0 || row > 25 || blocked.has(`${col},${row}`)) continue;
      if (canFinish(col, row)) firstSteps.push([col, row]);
    }
    assert.ok(firstSteps.length >= 2, `${puzzle.id}: multiple direct lanes not found`);
  }
});
