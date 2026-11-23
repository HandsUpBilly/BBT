import assert from 'node:assert/strict';
import test from 'node:test';
import { readContentCatalog, writeContentItem } from '../functions/contentStore.js';
import { readDraftScenarios, readDraftSeries, readPublishedContent, toPublicView } from '../functions/editorStore.js';

function fakeStore() {
  const data = new Map();
  let count = 0;
  return {
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
}

const scenario = {
  id: 'one', name: 'One', description: 'Original', objective: 'touchdown',
  activeTeam: 'human', teams: ['human', 'orc'], enabledActions: ['move'],
  published: true, ballPosition: null, pieces: [{
    id: 'p', team: 'human', role: 'lineman', name: 'Runner',
    ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [],
    position: { col: 1, row: 2 }, hasBall: true,
  }],
};
const importLegacy = async () => ({ scenarios: [scenario], series: [] });

test('ranking-reset targets track the published snapshot, not an unpublished Save Draft', async () => {
  const store = fakeStore();
  await readContentCatalog(store, importLegacy);

  // An admin disables "Enabled for players" and clicks Save Draft only,
  // without Publish Draft — the issue #396 failure scenario. The puzzle
  // stays live for players because nothing promoted the draft.
  await writeContentItem(store, importLegacy, {
    kind: 'scenarios', id: 'one', expectedRevision: 1,
    value: { ...scenario, published: false },
  });

  const { scenarios: ranked } = await readPublishedContent(store);
  assert.ok(ranked.some(item => item.id === 'one'),
    'ranking-reset targets must come from the published catalog, not the draft');

  // Before the fix, editor-rankings.js computed its target list from the
  // draft view instead, which would have already dropped the live puzzle.
  const draftView = toPublicView(await readDraftScenarios(store), await readDraftSeries(store));
  assert.equal(draftView.scenarios.some(item => item.id === 'one'), false);
});
