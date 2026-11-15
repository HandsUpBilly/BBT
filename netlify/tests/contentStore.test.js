import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTENT_KEY, catalogStorageKey, ContentConflictError, contentVersions, readContentCatalog,
  reconcileToDeployment, writeContentItem,
} from '../functions/contentStore.js';

function fakeStore() {
  const data = new Map();
  let count = 0;
  const store = {
    async getWithMetadata(key) {
      const item = data.get(key);
      return item ? { data: item.value, etag: String(item.etag) } : null;
    },
    async set(key, value, conditions = {}) {
      const previous = data.get(key);
      if (conditions.onlyIfNew && previous) return { modified: false };
      if (conditions.onlyIfMatch && (!previous || String(previous.etag) !== conditions.onlyIfMatch))
        return { modified: false };
      data.set(key, { value, etag: ++count });
      return { modified: true };
    },
  };
  return { store, data };
}
const old = { scenarios: [
  { id: 'one', name: 'One', description: 'Original', pieces: [{ id: 'p', position: { col: 1, row: 2 } }] },
  { id: 'two', name: 'Two' },
], series: [{ id: 'demo', name: 'Demo', scenarioIds: ['one', 'two'] }] };
const importLegacy = async () => structuredClone(old);

test('bootstraps legacy authored content once, preserving all existing IDs', async () => {
  const { store } = fakeStore();
  const catalog = await readContentCatalog(store, importLegacy);
  assert.equal(catalog.scenarios.length, 2);
  assert.equal(catalog.series[0].id, 'demo');
  assert.equal((await readContentCatalog(store, importLegacy)).schema, 3);
  assert.ok(contentVersions(catalog).revisions['scenarios/one'] >= 1);
});

test('saving one puzzle increments only its revision', async () => {
  const { store } = fakeStore();
  const catalog = await readContentCatalog(store, importLegacy);
  const item = { ...catalog.scenarios[0], description: 'Edited' };
  const updated = await writeContentItem(store, importLegacy, {
    kind: 'scenarios', id: 'one', expectedRevision: 1, value: item,
  });
  assert.equal(updated.revision, 2);
  assert.equal(updated.catalog.revisions['scenarios/two'], 1);
  assert.equal(updated.catalog.scenarios.find(x => x.id === 'one').description, 'Edited');
});

test('two concurrent writes to unrelated puzzles do not overwrite one another', async () => {
  const { store } = fakeStore();
  await readContentCatalog(store, importLegacy);
  const writes = await Promise.all([
    writeContentItem(store, importLegacy, {
      kind: 'scenarios', id: 'one', expectedRevision: 1,
      value: { ...old.scenarios[0], name: 'First edit' },
    }),
    writeContentItem(store, importLegacy, {
      kind: 'scenarios', id: 'two', expectedRevision: 1,
      value: { ...old.scenarios[1], name: 'Second edit' },
    }),
  ]);
  assert.equal(writes.length, 2);
  const final = await readContentCatalog(store, importLegacy);
  assert.equal(final.scenarios.find(x => x.id === 'one').name, 'First edit');
  assert.equal(final.scenarios.find(x => x.id === 'two').name, 'Second edit');
});

test('concurrent edits to the same puzzle reject a stale revision', async () => {
  const { store } = fakeStore();
  await readContentCatalog(store, importLegacy);
  const responses = await Promise.allSettled(['A', 'B'].map(name =>
    writeContentItem(store, importLegacy, {
      kind: 'scenarios', id: 'one', expectedRevision: 1,
      value: { ...old.scenarios[0], name },
    })));
  assert.equal(responses.filter(x => x.status === 'fulfilled').length, 1);
  assert.ok(responses.some(x => x.status === 'rejected' && x.reason instanceof ContentConflictError));
});

test('a stale revision is rejected even when content matches an older version', async () => {
  const { store } = fakeStore();
  await readContentCatalog(store, importLegacy);
  await writeContentItem(store, importLegacy, {
    kind: 'scenarios', id: 'one', value: { ...old.scenarios[0], name: 'Updated' }, expectedRevision: 1,
  });
  await assert.rejects(writeContentItem(store, importLegacy, {
    kind: 'scenarios', id: 'one', value: old.scenarios[0], expectedRevision: 1,
  }), ContentConflictError);
});

test('scenario deletion removes series references in the same CAS transaction', async () => {
  const { store } = fakeStore();
  await readContentCatalog(store, importLegacy);
  const changed = await writeContentItem(store, importLegacy, {
    kind: 'scenarios', id: 'one', value: null, expectedRevision: 1,
  });
  assert.deepEqual(changed.catalog.series[0].scenarioIds, ['two']);
  assert.equal(changed.catalog.scenarios.some(x => x.id === 'one'), false);
  assert.equal(changed.catalog.revisions['series/demo'], 2);
});

test('repo change merges unrelated editor edits and flags overlapping edits', () => {
  const before = { schema: 3, baseline: {
    scenarios: [{ id: 'x', name: 'Old', description: 'Original' }], series: [],
  }, scenarios: [{ id: 'x', name: 'Editor', description: 'Original' }], series: [],
  revisions: { 'scenarios/x': 2 }, conflicts: { scenarios: {}, series: {} }, history: [] };
  const merged = reconcileToDeployment(before, {
    scenarios: [{ id: 'x', name: 'GitHub', description: 'Updated' }], series: [],
  });
  assert.deepEqual(merged.conflicts.scenarios.x, ['name']);
  assert.equal(merged.scenarios[0].name, 'Editor');
  assert.equal(merged.scenarios[0].description, 'Updated');
  assert.equal(merged.revisions['scenarios/x'], 3);
});

test('read-only request does not modify the store if the seed is unchanged', async () => {
  const { store, data } = fakeStore();
  await readContentCatalog(store, importLegacy);
  const before = data.get(CONTENT_KEY).etag;
  await readContentCatalog(store, importLegacy);
  assert.equal(data.get(CONTENT_KEY).etag, before);
});

test('preview and staging catalog snapshots cannot overwrite production content', () => {
  assert.equal(catalogStorageKey({ CONTEXT: 'production' }), CONTENT_KEY);
  assert.equal(catalogStorageKey({ CONTEXT: 'deploy-preview', REVIEW_ID: '374' }),
    'content-v3/preview-374');
  assert.equal(catalogStorageKey({ CONTEXT: 'dev' }), 'content-v3/local-dev');
  assert.equal(catalogStorageKey({ CONTEXT: 'branch-deploy', BRANCH: 'staging' }),
    'content-v3/branch-staging');
});
