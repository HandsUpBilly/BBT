import test from 'node:test';
import assert from 'node:assert/strict';
import { planContentExport } from './contentGitSync.js';

const base = { id: 'p', name: 'Original', description: 'Description' };

test('no PR edit when live matches deployed baseline', () => {
  assert.deepEqual(planContentExport({ kind: 'scenarios', id: 'p', base, live: base,
    remote: { ...base, name: 'Updated in staging' } }), { change: null, conflicts: [] });
});

test('a live-only edit becomes a reviewed GitHub file change', () => {
  const live = { ...base, description: 'Editor change' };
  const result = planContentExport({ kind: 'scenarios', id: 'p', base, live, remote: base });
  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(result.change, { path: 'client/src/scenarios/p.json', value: live });
});

test('disjoint GitHub and editor fields merge rather than clobbering', () => {
  const live = { ...base, description: 'Editor change' };
  const remote = { ...base, name: 'New name from GitHub' };
  const plan = planContentExport({ kind: 'scenarios', id: 'p', base, live, remote });
  assert.deepEqual(plan.conflicts, []);
  assert.deepEqual(plan.change.value, { ...remote, description: 'Editor change' });
});

test('overlapping GitHub and live edits are rejected', () => {
  const plan = planContentExport({
    kind: 'scenarios', id: 'p', base,
    live: { ...base, name: 'Editor' }, remote: { ...base, name: 'GitHub' },
  });
  assert.deepEqual(plan.conflicts, ['name']);
  assert.equal(plan.change, null);
});

test('live deletion becomes a GitHub delete only for unchanged remote', () => {
  const deletion = planContentExport({ kind: 'series', id: 'p', base, live: undefined, remote: base });
  assert.deepEqual(deletion, {
    change: { path: 'client/src/series/p.json', value: undefined }, conflicts: [],
  });
  const protectedEdit = planContentExport({
    kind: 'series', id: 'p', base, live: undefined, remote: { ...base, name: 'Edited' },
  });
  assert.deepEqual(protectedEdit.conflicts, ['$']);
});

test('editor-created puzzle is added without overwriting an existing GitHub ID', () => {
  const fresh = planContentExport({ kind: 'scenarios', id: 'new', base: undefined,
    live: { id: 'new', name: 'Live' }, remote: undefined });
  assert.deepEqual(fresh.conflicts, []);
  assert.equal(fresh.change.path, 'client/src/scenarios/new.json');
  const conflict = planContentExport({ kind: 'scenarios', id: 'new', base: undefined,
    live: { id: 'new', name: 'Live' }, remote: { id: 'new', name: 'Staging' } });
  assert.deepEqual(conflict.conflicts, ['name']);
});
