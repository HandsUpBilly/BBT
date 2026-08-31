import assert from 'node:assert/strict';
import test from 'node:test';
import { clearRankingTarget, readRankingResetSummary } from '../functions/rankingResetStore.js';

function fakeStore(initial = {}) {
  const values = new Map(Object.entries(initial).map(([key, entries]) => [key, JSON.stringify(entries)]));
  let etag = 0;
  return {
    async list() { return { blobs: [...values.keys()].map(key => ({ key })), directories: [] }; },
    async getWithMetadata(key) {
      return values.has(key) ? { data: values.get(key), etag: `e${etag}` } : { data: null };
    },
    async set(key, value) {
      values.set(key, value);
      etag += 1;
      return { modified: true };
    },
    entries(key) { return JSON.parse(values.get(key) ?? '[]'); },
  };
}

const scenarios = [{ id: 'puzzle-one', name: 'Puzzle One' }];
const series = { id: 'default', name: 'Tutorial' };

test('summary includes published, legacy, and series boards with full retained counts', async () => {
  const scenarioStore = fakeStore({
    'puzzle-one': [{ id: '1' }],
    'deleted-puzzle': [{ id: '2' }, { id: '3' }],
  });
  const seriesStore = fakeStore({ series: [{ id: '4' }] });
  const summary = await readRankingResetSummary({ scenarioStore, seriesStore, scenarios, series });

  assert.equal(summary.totalEntries, 4);
  assert.deepEqual(summary.series, [{ id: 'default', name: 'Tutorial', count: 1 }]);
  assert.deepEqual(summary.puzzles, [
    { id: 'deleted-puzzle', name: 'deleted-puzzle', count: 2 },
    { id: 'puzzle-one', name: 'Puzzle One', count: 1 },
  ]);
});

test('clears one puzzle without touching the series or another puzzle', async () => {
  const scenarioStore = fakeStore({
    'puzzle-one': [{ id: '1' }],
    'puzzle-two': [{ id: '2' }],
  });
  const seriesStore = fakeStore({ series: [{ id: '3' }] });
  const result = await clearRankingTarget({
    scenarioStore, seriesStore, scenarios, series,
    target: { scope: 'puzzle', id: 'puzzle-one' },
  });

  assert.equal(result.removed, 1);
  assert.deepEqual(scenarioStore.entries('puzzle-one'), []);
  assert.equal(scenarioStore.entries('puzzle-two').length, 1);
  assert.equal(seriesStore.entries('series').length, 1);
});

test('complete reset clears every stored puzzle and series board, including legacy keys', async () => {
  const scenarioStore = fakeStore({
    'puzzle-one': [{ id: '1' }],
    legacy: [{ id: '2' }],
  });
  const seriesStore = fakeStore({ series: [{ id: '3' }], 'series:old-cup': [{ id: '4' }] });
  const result = await clearRankingTarget({
    scenarioStore, seriesStore, scenarios, series,
    target: { scope: 'all' },
  });

  assert.equal(result.removed, 4);
  assert.deepEqual(scenarioStore.entries('puzzle-one'), []);
  assert.deepEqual(scenarioStore.entries('legacy'), []);
  assert.deepEqual(seriesStore.entries('series'), []);
  assert.deepEqual(seriesStore.entries('series:old-cup'), []);
});
