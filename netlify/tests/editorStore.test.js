import assert from 'node:assert/strict';
import test from 'node:test';
import { toPublicView } from '../functions/editorStore.js';

const scenarios = [
  { id: 'scenario-001', published: true },
  { id: 'scenario-002' }, // published is optional; undefined means published
  { id: 'scenario-003', published: false },
  { id: 'scenario-004', published: false, adminEnabled: true },
];

test('toPublicView keeps only scenarios that are not explicitly unpublished', () => {
  const { scenarios: published } = toPublicView(scenarios, { scenarioIds: [] });
  assert.deepEqual(published.map(s => s.id), ['scenario-001', 'scenario-002']);
});

test('toPublicView never exposes admin-only scenarios or series', () => {
  const result = toPublicView(scenarios, [
    { id: 'public', scenarioIds: ['scenario-001', 'scenario-004'] },
    { id: 'admin-only', published: false, adminEnabled: true, scenarioIds: ['scenario-004'] },
  ]);
  assert.deepEqual(result.scenarios.map(item => item.id), ['scenario-001', 'scenario-002']);
  assert.deepEqual(result.series.map(item => item.id), ['public']);
  assert.deepEqual(result.series[0].scenarioIds, ['scenario-001']);
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

test('toPublicView narrows every series in the new collection shape', () => {
  const result = toPublicView(scenarios, [
    { id: 'one', scenarioIds: ['scenario-001', 'scenario-003'] },
    { id: 'two', scenarioIds: ['scenario-002', 'missing'] },
  ]);
  assert.deepEqual(result.series.map(item => item.scenarioIds), [['scenario-001'], ['scenario-002']]);
});

test('toPublicView hides disabled series while leaving enabled series available', () => {
  const result = toPublicView(scenarios, [
    { id: 'enabled', published: true, scenarioIds: ['scenario-001'] },
    { id: 'disabled', published: false, scenarioIds: ['scenario-002'] },
  ]);
  assert.deepEqual(result.series.map(item => item.id), ['enabled']);
});
