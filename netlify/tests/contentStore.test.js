import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTENT_KEY, catalogStorageKey, ContentConflictError, contentVersions, readContentCatalog,
  reconcileToDeployment, writeContentItem, publishContentItem, contentPublicView,
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

test('previous merge conflicts persist across an unrelated GitHub deploy', () => {
  const snapshot = {
    schema: 3,
    baseline: { scenarios: [{ id: 'x', name: 'GitHub', description: 'Old' }], series: [] },
    scenarios: [{ id: 'x', name: 'Editor', description: 'Old' }], series: [],
    revisions: { 'scenarios/x': 3 },
    conflicts: { scenarios: { x: ['name'] }, series: {} },
    history: [],
  };
  const merged = reconcileToDeployment(snapshot, {
    scenarios: [{ id: 'x', name: 'GitHub', description: 'New' }], series: [],
  });
  assert.deepEqual(merged.conflicts.scenarios.x, ['name']);
  assert.equal(merged.scenarios[0].description, 'New');
});

test('GitHub adopting the live editor value resolves an existing conflict', () => {
  const snapshot = {
    schema: 3,
    baseline: { scenarios: [{ id: 'x', name: 'GitHub' }], series: [] },
    scenarios: [{ id: 'x', name: 'Editor' }], series: [],
    revisions: { 'scenarios/x': 3 },
    conflicts: { scenarios: { x: ['name'] }, series: {} },
    history: [],
  };
  const merged = reconcileToDeployment(snapshot, {
    scenarios: [{ id: 'x', name: 'Editor' }], series: [],
  });
  assert.equal(merged.conflicts.scenarios.x, undefined);
});

test('Save Draft leaves public puzzle and series definitions unchanged until Publish', async () => {
  const { store } = fakeStore();
  await readContentCatalog(store, importLegacy);
  const saved = await writeContentItem(store, importLegacy, {
    kind: 'scenarios', id: 'one', expectedRevision: 1,
    value: { ...old.scenarios[0], description: 'Private work in progress' },
  });
  assert.equal(saved.revision, 2);
  assert.equal(contentPublicView(saved.catalog).scenarios.find(item => item.id === 'one').description, 'Original');
  assert.deepEqual(contentVersions(saved.catalog).pendingPublish.scenarios, ['one']);
  const published = await publishContentItem(store, importLegacy, {
    kind: 'scenarios', id: 'one', expectedRevision: 2, expectedPublishedRevision: 1,
  });
  assert.equal(published.publishedRevision, 2);
  assert.equal(contentPublicView(published.catalog).scenarios.find(item => item.id === 'one').description,
    'Private work in progress');
  assert.deepEqual(contentVersions(published.catalog).pendingPublish.scenarios, []);
});

test('Publish rejects a stale draft or stale published revision', async () => {
  const { store } = fakeStore();
  await readContentCatalog(store, importLegacy);
  await writeContentItem(store, importLegacy, {
    kind: 'scenarios', id: 'one', expectedRevision: 1,
    value: { ...old.scenarios[0], description: 'Changed' },
  });
  await assert.rejects(publishContentItem(store, importLegacy, {
    kind: 'scenarios', id: 'one', expectedRevision: 1, expectedPublishedRevision: 1,
  }), ContentConflictError);
  await publishContentItem(store, importLegacy, {
    kind: 'scenarios', id: 'one', expectedRevision: 2, expectedPublishedRevision: 1,
  });
  await assert.rejects(publishContentItem(store, importLegacy, {
    kind: 'scenarios', id: 'one', expectedRevision: 2, expectedPublishedRevision: 1,
  }), ContentConflictError);
});

test('unpublish requires its own explicit promotion and retains the saved draft', async () => {
  const { store } = fakeStore();
  await readContentCatalog(store, importLegacy);
  const draft = await writeContentItem(store, importLegacy, {
    kind: 'scenarios', id: 'one', expectedRevision: 1,
    value: { ...old.scenarios[0], published: false },
  });
  assert.equal(contentPublicView(draft.catalog).scenarios.some(item => item.id === 'one'), true);
  const unpublished = await publishContentItem(store, importLegacy, {
    kind: 'scenarios', id: 'one', expectedRevision: 2, expectedPublishedRevision: 1,
  });
  assert.equal(contentPublicView(unpublished.catalog).scenarios.some(item => item.id === 'one'), false);
  assert.equal(unpublished.catalog.scenarios.find(item => item.id === 'one').published, false);
  assert.deepEqual(contentPublicView(unpublished.catalog).series[0].scenarioIds, ['two']);
});

test('series drafts stay private and cannot publish references to unpublished puzzles', async () => {
  const { store } = fakeStore();
  await readContentCatalog(store, importLegacy);
  await writeContentItem(store, importLegacy, {
    kind: 'series', id: 'demo', expectedRevision: 1,
    value: { ...old.series[0], name: 'New series draft' },
  });
  const publicBefore = contentPublicView(await readContentCatalog(store, importLegacy));
  assert.equal(publicBefore.series[0].name, 'Demo');
  const published = await publishContentItem(store, importLegacy, {
    kind: 'series', id: 'demo', expectedRevision: 2, expectedPublishedRevision: 1,
  });
  assert.equal(contentPublicView(published.catalog).series[0].name, 'New series draft');

  // Disable the puzzle and explicitly unpublish it. The saved series draft
  // still refers to that ID and cannot be published until it removes the step.
  await writeContentItem(store, importLegacy, {
    kind: 'scenarios', id: 'one', expectedRevision: 1,
    value: { ...old.scenarios[0], published: false },
  });
  await publishContentItem(store, importLegacy, {
    kind: 'scenarios', id: 'one', expectedRevision: 2, expectedPublishedRevision: 1,
  });
  await writeContentItem(store, importLegacy, {
    kind: 'series', id: 'demo', expectedRevision: 2,
    value: { ...old.series[0], name: 'Different name' },
  });
  await assert.rejects(publishContentItem(store, importLegacy, {
    kind: 'series', id: 'demo', expectedRevision: 3, expectedPublishedRevision: 2,
  }), /Publish its puzzles first/);
});

test('GitHub-only changes reach the public snapshot but editor-only drafts do not', () => {
  const baseline = { scenarios: [{ id: 'x', name: 'Original', description: 'Old' }], series: [] };
  const snapshot = {
    schema: 3, baseline,
    scenarios: [{ id: 'x', name: 'Editor draft', description: 'Old' }],
    series: [], publishedScenarios: [{ id: 'x', name: 'Original', description: 'Old' }],
    publishedSeries: [], revisions: { 'scenarios/x': 2 },
    publishedRevisions: { 'scenarios/x': 1 },
    conflicts: { scenarios: {}, series: {} }, history: [],
  };
  const merged = reconcileToDeployment(snapshot, {
    scenarios: [{ id: 'x', name: 'Original', description: 'GitHub deployment' }], series: [],
  });
  assert.equal(merged.scenarios[0].name, 'Editor draft');
  assert.equal(merged.scenarios[0].description, 'GitHub deployment');
  assert.equal(contentPublicView(merged).scenarios[0].name, 'Original');
  assert.equal(contentPublicView(merged).scenarios[0].description, 'GitHub deployment');
});

test('explicit destructive deletion unpublishes a puzzle and cleans series references', async () => {
  const { store } = fakeStore();
  await readContentCatalog(store, importLegacy);
  const result = await writeContentItem(store, importLegacy, {
    kind: 'scenarios', id: 'one', value: null, expectedRevision: 1,
  });
  assert.equal(contentPublicView(result.catalog).scenarios.some(item => item.id === 'one'), false);
  assert.deepEqual(contentPublicView(result.catalog).series[0].scenarioIds, ['two']);
});

test('upgrades old v3 catalog to separate publication snapshots on first read', async () => {
  const { store, data } = fakeStore();
  const initial = await readContentCatalog(store, importLegacy);
  const legacyV3 = { ...initial };
  delete legacyV3.publishedScenarios;
  delete legacyV3.publishedSeries;
  delete legacyV3.publishedRevisions;
  const oldEntry = data.get(CONTENT_KEY);
  data.set(CONTENT_KEY, { ...oldEntry, value: JSON.stringify(legacyV3) });
  const upgraded = await readContentCatalog(store, importLegacy);
  assert.equal(upgraded.publishedScenarios.length, 2);
  assert.equal(upgraded.publishedSeries.length, 1);
  assert.equal(upgraded.publishedRevisions['scenarios/one'], 1);
});
