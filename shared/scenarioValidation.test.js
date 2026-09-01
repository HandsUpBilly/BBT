import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SCENARIO_ID_RE,
  missingSeriesScenarioIds,
  normalizeScenario,
  normalizeSeries,
  normalizeSeriesCollection,
  scenarioRosterErrors,
  seriesMembershipErrors,
  updateSeriesAssignment,
  validateScenario,
} from './scenarioValidation.js';

function validScenario(overrides = {}) {
  return normalizeScenario({
    id: 'scenario-010',
    name: 'Test Puzzle',
    description: 'A puzzle for tests.',
    activeTeam: 'human',
    pieces: [
      {
        id: 'human-1', team: 'human', role: 'thrower', name: 'Aldric',
        ma: 6, st: 3, ag: 3, pa: 3, av: 8, skills: ['Block'],
        position: { col: 7, row: 10 }, hasBall: true,
      },
      {
        id: 'orc-1', team: 'orc', role: 'blocker', name: 'Grukk',
        ma: 4, st: 3, ag: 3, pa: 6, av: 9, skills: [],
        position: { col: 7, row: 8 }, hasBall: false,
      },
    ],
    ...overrides,
  });
}

test('accepts a well-formed scenario', () => {
  assert.deepEqual(validateScenario(validScenario()), []);
});

test('rejects malformed ids', () => {
  for (const id of ['Scenario-1', '-leading', 'has space', '', 'UPPER']) {
    assert.equal(SCENARIO_ID_RE.test(id), false, `${id} should be rejected`);
  }
  assert.ok(validateScenario(validScenario({ id: 'Bad Id' })).some(e => /lowercase/.test(e)));
});

test('enforces stat ranges — the check the client used to be missing', () => {
  const errors = validateScenario(validScenario({
    pieces: [
      { id: 'a', team: 'human', name: 'A', ma: 6, st: 99, ag: 3, pa: 3, av: 8, skills: [], position: { col: 1, row: 1 }, hasBall: true },
    ],
  }));
  assert.ok(errors.some(e => e.includes('ST must be between 1 and 12')));
});

test('rejects out-of-bounds positions in both axes', () => {
  const wideCol = validateScenario(validScenario({
    pieces: [{ id: 'a', team: 'human', name: 'A', ma: 6, st: 3, ag: 3, pa: 3, av: 8, skills: [], position: { col: 15, row: 1 }, hasBall: true }],
  }));
  assert.ok(wideCol.some(e => e.includes('column must be between 0 and 14')));

  const wideRow = validateScenario(validScenario({
    pieces: [{ id: 'a', team: 'human', name: 'A', ma: 6, st: 3, ag: 3, pa: 3, av: 8, skills: [], position: { col: 1, row: 26 }, hasBall: true }],
  }));
  assert.ok(wideRow.some(e => e.includes('row must be between 0 and 25')));
});

test('rejects two players on the same square', () => {
  const errors = validateScenario(validScenario({
    pieces: [
      { id: 'a', team: 'human', name: 'A', ma: 6, st: 3, ag: 3, pa: 3, av: 8, skills: [], position: { col: 4, row: 4 }, hasBall: true },
      { id: 'b', team: 'orc', name: 'B', ma: 4, st: 3, ag: 3, pa: 6, av: 9, skills: [], position: { col: 4, row: 4 }, hasBall: false },
    ],
  }));
  assert.ok(errors.some(e => e.includes('Multiple players on square 4,4')));
});

test('enforces exactly one ball', () => {
  const twoCarriers = validateScenario(validScenario({
    pieces: [
      { id: 'a', team: 'human', name: 'A', ma: 6, st: 3, ag: 3, pa: 3, av: 8, skills: [], position: { col: 1, row: 1 }, hasBall: true },
      { id: 'b', team: 'human', name: 'B', ma: 6, st: 3, ag: 3, pa: 3, av: 8, skills: [], position: { col: 2, row: 2 }, hasBall: true },
    ],
  }));
  assert.ok(twoCarriers.some(e => e.includes('Only one player can carry the ball')));

  const noBall = validateScenario(validScenario({
    pieces: [{ id: 'a', team: 'human', name: 'A', ma: 6, st: 3, ag: 3, pa: 3, av: 8, skills: [], position: { col: 1, row: 1 }, hasBall: false }],
  }));
  assert.ok(noBall.some(e => e.includes('Place the ball')));

  const both = validateScenario(validScenario({ ballPosition: { col: 3, row: 3 } }));
  assert.ok(both.some(e => e.includes('carried or loose, not both')));
});

test('requires a player on the active team', () => {
  const errors = validateScenario(validScenario({
    activeTeam: 'orc',
    pieces: [{ id: 'a', team: 'human', name: 'A', ma: 6, st: 3, ag: 3, pa: 3, av: 8, skills: [], position: { col: 1, row: 1 }, hasBall: true }],
  }));
  assert.ok(errors.some(e => e.includes('must belong to the active team')));
});

test('enforces BB2025 positional and on-pitch roster limits', () => {
  assert.deepEqual(scenarioRosterErrors({
    pieces: Array.from({ length: 3 }, (_, index) => ({ team: 'human', role: 'blitzer', id: `h${index}` })),
  }), ['Human roster allows at most 2 Human Blitzers (currently 3)']);

  assert.deepEqual(scenarioRosterErrors({
    pieces: [{ team: 'orc', role: 'troll' }, { team: 'orc', role: 'troll' }],
  }), ['Orc roster allows at most 1 Troll (currently 2)']);

  assert.ok(scenarioRosterErrors({
    pieces: Array.from({ length: 12 }, () => ({ team: 'orc', role: 'lineman' })),
  }).includes('Orc team may field at most 11 players (currently 12)'));

  assert.deepEqual(scenarioRosterErrors({ pieces: [{ team: 'orc', role: 'catcher' }] }), [
    'Orc roster does not allow role: catcher',
  ]);
});

test('seriesMembershipErrors identifies an invalid roster in an assigned puzzle', () => {
  const series = normalizeSeries({ id: 'league', scenarioIds: ['two-trolls'] });
  const scenarios = [{
    id: 'two-trolls', name: 'Two Troll Trouble',
    pieces: [{ team: 'orc', role: 'troll' }, { team: 'orc', role: 'troll' }],
  }];
  assert.deepEqual(seriesMembershipErrors(series, [], scenarios), [
    'Two Troll Trouble: Orc roster allows at most 1 Troll (currently 2)',
  ]);
});

test('id uniqueness respects currentId and allowExisting', () => {
  const taken = new Set(['scenario-010']);
  assert.ok(validateScenario(validScenario(), taken).some(e => e.includes('already exists')));
  // Editing the same scenario is fine.
  assert.deepEqual(validateScenario(validScenario(), taken, { currentId: 'scenario-010' }), []);
  assert.deepEqual(validateScenario(validScenario(), taken, { allowExisting: true }), []);
});

test('normalizeScenario coerces hostile input rather than throwing', () => {
  const scenario = normalizeScenario({ pieces: 'not-an-array', ballPosition: 'nope' });
  assert.deepEqual(scenario.pieces, []);
  assert.equal(scenario.ballPosition, null);
  assert.equal(scenario.activeTeam, 'human');
  assert.deepEqual(scenario.teams, ['human', 'orc']);
  assert.equal(scenario.published, true);
  // A completely bogus payload is invalid, not a crash.
  assert.ok(validateScenario(scenario).length > 0);
});

test('normalizes the two puzzle teams and validates roster membership', () => {
  const scenario = validScenario({ teams: ['orc', 'human'] });
  assert.deepEqual(scenario.teams, ['orc', 'human']);
  assert.deepEqual(validateScenario(scenario), []);

  const invalid = { ...scenario, teams: ['human', 'human'] };
  assert.ok(validateScenario(invalid).some(error => error.includes('two different teams')));
});

test('normalizers preserve explicit admin visibility without enabling it by default', () => {
  assert.equal(normalizeScenario({ adminEnabled: true }).adminEnabled, true);
  assert.equal(normalizeScenario({ adminEnabled: false }).adminEnabled, undefined);
  assert.equal(normalizeSeries({ adminEnabled: true }).adminEnabled, true);
  assert.equal(normalizeSeries({ adminEnabled: false }).adminEnabled, undefined);
});

test('normalizeSeries supplies future-ready defaults and preserves a valid id', () => {
  assert.deepEqual(normalizeSeries(null), {
    id: 'default', name: 'Default Series', description: '', scenarioIds: [],
    published: true, teams: ['human', 'orc'], objective: 'touchdown', order: 0,
  });
  assert.deepEqual(
    normalizeSeries({ id: 'hacked', name: '  Cup  ', scenarioIds: ['a', '', 'b'] }),
    { id: 'hacked', name: 'Cup', description: '', scenarioIds: ['a', 'b'], published: true, teams: ['human', 'orc'], objective: 'touchdown', order: 0 },
  );
});

test('normalizeSeries removes duplicate puzzle steps while preserving their first position', () => {
  assert.deepEqual(
    normalizeSeries({ id: 'cup', scenarioIds: ['a', 'b', 'a', 'b', 'c'] }).scenarioIds,
    ['a', 'b', 'c'],
  );
});

test('seriesMembershipErrors rejects enabled empty series and puzzles owned elsewhere', () => {
  assert.deepEqual(seriesMembershipErrors(
    normalizeSeries({ id: 'empty', published: true, scenarioIds: [] }),
  ), ['An enabled series must contain at least one puzzle']);

  assert.deepEqual(seriesMembershipErrors(
    normalizeSeries({ id: 'second', scenarioIds: ['scenario-001'] }),
    [normalizeSeries({ id: 'first', name: 'First Series', scenarioIds: ['scenario-001'] })],
  ), ['scenario-001 is already assigned to First Series']);

  assert.deepEqual(seriesMembershipErrors(
    normalizeSeries({ id: 'admin-empty', published: false, adminEnabled: true, scenarioIds: [] }),
  ), ['An enabled series must contain at least one puzzle']);
});

test('updateSeriesAssignment never reorders an existing step or silently moves it', () => {
  const collection = [
    normalizeSeries({ id: 'first', name: 'First Series', scenarioIds: ['a', 'b'] }),
    normalizeSeries({ id: 'second', name: 'Second Series', published: false, scenarioIds: [] }),
  ];
  assert.deepEqual(updateSeriesAssignment(collection, 'a', 'first'), { series: collection, errors: [] });
  assert.deepEqual(updateSeriesAssignment(collection, 'a', 'second'), {
    series: collection,
    errors: ['a is already assigned to First Series'],
  });
});

test('updateSeriesAssignment cannot leave an enabled series with no steps', () => {
  const collection = [normalizeSeries({ id: 'only', name: 'Only Series', scenarioIds: ['a'] })];
  assert.deepEqual(updateSeriesAssignment(collection, 'a', ''), {
    series: collection,
    errors: ['An enabled series must contain at least one puzzle'],
  });
});

test('normalizeSeries preserves a bounded series logo key', () => {
  assert.deepEqual(normalizeSeries({ logo: '  nuffle-shuffle  ', scenarioIds: [] }), {
    id: 'default', name: 'Default Series', description: '', scenarioIds: [], published: true, teams: ['human', 'orc'], objective: 'touchdown', order: 0, logo: 'nuffle-shuffle',
  });
  assert.deepEqual(normalizeSeries({ logo: 42, scenarioIds: [] }), {
    id: 'default', name: 'Default Series', description: '', scenarioIds: [], published: true, teams: ['human', 'orc'], objective: 'touchdown', order: 0,
  });
  const uploadedLogo = `data:image/webp;base64,${Buffer.from('series-logo').toString('base64')}`;
  assert.equal(normalizeSeries({ logo: uploadedLogo }).logo, uploadedLogo);
  assert.equal(normalizeSeries({ logo: 'https://example.com/tracker.png' }).logo, undefined);
  assert.equal(normalizeSeries({ logo: 'data:image/png;base64,YWJj' }).logo, undefined);
});

test('normalizeSeries preserves a bounded player-facing label', () => {
  assert.equal(normalizeSeries({ label: '  League  ' }).label, 'League');
  assert.equal(normalizeSeries({ label: 'x'.repeat(50) }).label, 'x'.repeat(40));
  assert.equal(normalizeSeries({ label: 42 }).label, undefined);
});

test('normalizeSeriesCollection migrates a legacy object and sorts multiple series', () => {
  assert.deepEqual(normalizeSeriesCollection({ id: 'legacy', scenarioIds: [] }).map(item => item.id), ['legacy']);
  assert.deepEqual(normalizeSeriesCollection([
    { id: 'later', order: 2, scenarioIds: [] },
    { id: 'first', order: 0, scenarioIds: [] },
  ]).map(item => item.id), ['first', 'later']);
});

test('missingSeriesScenarioIds reports dangling references', () => {
  const series = { scenarioIds: ['a', 'b', 'c'] };
  const scenarios = [{ id: 'a' }, { id: 'c' }];
  assert.deepEqual(missingSeriesScenarioIds(series, scenarios), ['b']);
  assert.deepEqual(missingSeriesScenarioIds(null, scenarios), []);
});
