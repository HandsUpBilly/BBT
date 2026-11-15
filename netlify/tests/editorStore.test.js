import assert from 'node:assert/strict';
import test from 'node:test';
import { readDraftSeries, toPublicView } from '../functions/editorStore.js';

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

test('readDraftSeries rebalances the original lineups once and preserves custom metadata', async () => {
  const secondIds = ['scenario-007', 'scenario-008', 'scenario-009', 'scenario-010'];
  const thirdIds = Array.from({ length: 12 }, (_, index) =>
    `blood-feud-${String(index + 1).padStart(2, '0')}`);
  const storedSeries = [
    { id: 'legacy-second', description: 'Custom copy', scenarioIds: secondIds },
    { id: 'blood-feud', scenarioIds: thirdIds },
  ];
  const values = new Map([
    ['series-default', JSON.stringify(storedSeries)],
    ['series-expansion-2026-11-v1-series', 'done'],
  ]);
  const store = {
    get: async key => values.get(key),
    set: async (key, value) => values.set(key, value),
  };

  const balanced = await readDraftSeries(store);
  const movedIds = [thirdIds[0], thirdIds[3], thirdIds[4], thirdIds[5]];
  assert.deepEqual(balanced[0].scenarioIds, [...secondIds, ...movedIds]);
  assert.equal(balanced[0].description, 'Custom copy');
  assert.deepEqual(balanced[1].scenarioIds, thirdIds.filter(id => !movedIds.includes(id)));

  values.set('series-default', JSON.stringify(storedSeries));
  assert.deepEqual((await readDraftSeries(store))[0].scenarioIds, secondIds);
});

test('Series 2 migration upgrades untouched Human lineups but preserves edited ones', async () => {
  const ids = ['blood-feud-01', 'blood-feud-04', 'blood-feud-05', 'blood-feud-06'];
  const originalRoles = { thrower: 'thrower', 'noble-blitzer': 'catcher', bodyguard: 'blitzer', retainer: 'lineman' };
  const originalNames = { thrower: 'Aldric Swiftfoot', catcher: 'Joren Fleetstep',
    blitzer: 'Cedric Linebreaker', lineman: 'Bramm Surehands' };
  const makeLegacy = scenario => ({
    ...scenario,
    activeTeam: scenario.activeTeam === 'imperial-nobility' ? 'human' : scenario.activeTeam,
    teams: ['human', 'black-orc'],
    pieces: scenario.pieces.map(piece => {
      if (piece.team !== 'imperial-nobility') return piece;
      const role = originalRoles[piece.role];
      return { ...piece, team: 'human', role, name: originalNames[role] };
    }),
  });

  const seeded = structuredClone(STATIC_SCENARIOS);
  const positions = ids.map(id => seeded.findIndex(item => item.id === id));
  assert.ok(positions.every(index => index >= 0));
  for (const index of positions) seeded[index] = makeLegacy(seeded[index]);
  const custom = seeded.find(item => item.id === 'blood-feud-06');
  custom.pieces[0].position.row += 1;
  const stored = new Map([
    ['scenarios', JSON.stringify(seeded)],
    ['series-expansion-2026-11-v1-scenarios', 'done'],
  ]);
  const writes = [];
  const store = {
    async get(key) { return stored.get(key) ?? null; },
    async set(key, value) { writes.push(key); stored.set(key, value); },
  };
  const first = await readDraftScenarios(store);
  for (const id of ids.filter(item => item !== 'blood-feud-06')) {
    const scenario = first.find(item => item.id === id);
    assert.ok(scenario.pieces.some(piece => piece.team === 'imperial-nobility'), id);
    assert.ok(scenario.pieces.every(piece => scenario.teams.includes(piece.team)), id);
  }
  assert.ok(first.find(item => item.id === 'blood-feud-06').pieces.some(piece => piece.team === 'human'),
    'preserve user-customised board instead of overwriting');
  const after = writes.length;
  await readDraftScenarios(store);
  assert.equal(writes.length, after, 'migration marker stops recurring writes');
});
