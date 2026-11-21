import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileItem, reconcileCollection } from './contentReconcile.js';

const base = { id: 'x', name: 'Puzzle', description: 'Old', pieces: [
  { id: 'a', name: 'A', position: { col: 1, row: 2 }, skills: ['Block'] },
  { id: 'b', name: 'B', position: { col: 4, row: 2 }, skills: [] },
] };

test('GitHub changes arrive when the editor has not touched the puzzle', () => {
  const remote = { ...base, name: 'New' };
  assert.deepEqual(reconcileItem(base, base, remote), { value: remote, conflicts: [] });
});

test('a live edit remains when GitHub changes a different field', () => {
  const local = { ...base, description: 'Edited live' };
  const remote = { ...base, name: 'Changed in GitHub' };
  assert.deepEqual(reconcileItem(base, local, remote), {
    value: { ...local, name: 'Changed in GitHub' }, conflicts: [],
  });
});

test('changes to different players merge, even inside nested positions', () => {
  const local = structuredClone(base);
  const remote = structuredClone(base);
  local.pieces[0].position.col = 3;
  remote.pieces[0].position.row = 8;
  remote.pieces[1].skills.push('Dodge');
  const result = reconcileItem(base, local, remote);
  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(result.value.pieces[0].position, { col: 3, row: 8 });
  assert.deepEqual(result.value.pieces[1].skills, ['Dodge']);
});

test('competing edits preserve the live value and give an explicit conflict path', () => {
  const local = { ...base, name: 'Editor name' };
  const remote = { ...base, name: 'GitHub name' };
  assert.deepEqual(reconcileItem(base, local, remote), { value: local, conflicts: ['name'] });
});

test('series ordering is atomic and conflicts instead of silently rearranging membership', () => {
  const base = { id: 's', scenarioIds: ['a','b','c'] };
  const local = { ...base, scenarioIds: ['b','a','c'] };
  const remote = { ...base, scenarioIds: ['a','c','b'] };
  assert.deepEqual(reconcileItem(base, local, remote), { value: local, conflicts: ['scenarioIds'] });
});

test('editor deletion of a seeded item survives later GitHub edits', () => {
  const merged = reconcileCollection([base], [], [{ ...base, name: 'New' }]);
  assert.deepEqual(merged.items, []);
  assert.deepEqual(merged.conflicts.x, ['$']);
});

test('new GitHub and new editor puzzles appear together', () => {
  const x = { id: 'github' }, y = { id: 'live' };
  const merged = reconcileCollection([], [y], [x]);
  assert.deepEqual(merged.items, [x, y]);
  assert.deepEqual(merged.conflicts, {});
});

test('a GitHub deletion is respected if editor has not changed the item', () => {
  assert.deepEqual(reconcileCollection([base], [base], []), { items: [], conflicts: {} });
});
