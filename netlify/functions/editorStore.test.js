import assert from 'node:assert/strict';
import test from 'node:test';
import { toPublicView } from './editorStore.js';

const scenarios = [
  { id: 'scenario-001', published: true },
  { id: 'scenario-002' }, // published is optional; undefined means published
  { id: 'scenario-003', published: false },
];

test('toPublicView keeps only scenarios that are not explicitly unpublished', () => {
  const { scenarios: published } = toPublicView(scenarios, { scenarioIds: [] });
  assert.deepEqual(published.map(s => s.id), ['scenario-001', 'scenario-002']);
});

test('toPublicView narrows series.scenarioIds to the published set, preserving order', () => {
  const series = { id: 'default', scenarioIds: ['scenario-003', 'scenario-001', 'scenario-002'] };
  const { series: publicSeries } = toPublicView(scenarios, series);
  // scenario-003 is unpublished and must drop out without shifting the rest.
  assert.deepEqual(publicSeries.scenarioIds, ['scenario-001', 'scenario-002']);
});

test('toPublicView drops dangling series ids that reference no scenario at all', () => {
  const series = { id: 'default', scenarioIds: ['scenario-001', 'scenario-999'] };
  const { series: publicSeries } = toPublicView(scenarios, series);
  assert.deepEqual(publicSeries.scenarioIds, ['scenario-001']);
});

test('toPublicView tolerates a missing series object and an undefined scenarioIds', () => {
  assert.deepEqual(toPublicView(scenarios, null).series.scenarioIds, []);
  assert.deepEqual(toPublicView(scenarios, { id: 'default' }).series.scenarioIds, []);
});

test('toPublicView preserves other series fields untouched', () => {
  const series = { id: 'default', name: 'Default Run', scenarioIds: ['scenario-001'] };
  const { series: publicSeries } = toPublicView(scenarios, series);
  assert.equal(publicSeries.name, 'Default Run');
});
