import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AnalyticsValidationError,
  reduceAnalyticsBatch,
  validateAnalyticsBatch,
} from './analyticsValidation.js';

const receivedAt = '2026-08-19T12:00:00.000Z';
const sessionId = '22222222-2222-4222-8222-222222222222';
const batchId = '33333333-3333-4333-8333-333333333333';
const attemptId = '44444444-4444-4444-8444-444444444444';
const runId = '55555555-5555-4555-8555-555555555555';

function batch(events, overrides = {}) {
  return {
    schemaVersion: 1, batchId, sessionId,
    sessionStartedAt: '2026-08-19T11:00:00.000Z',
    events,
    ...overrides,
  };
}

test('validates, sanitizes, and reduces a complete puzzle attempt', () => {
  const validated = validateAnalyticsBatch(batch([
    { type: 'puzzle-started', at: '2026-08-19T11:01:00.000Z', data: { attemptId, scenarioId: 'scenario-001', scenarioName: 'Opening Drive', mode: 'standalone' } },
    { type: 'puzzle-action', at: '2026-08-19T11:01:10.000Z', data: { attemptId, action: 'move', count: 2 } },
    { type: 'active-time', at: '2026-08-19T11:02:00.000Z', data: { attemptId, seconds: 60 } },
    { type: 'puzzle-ended', at: '2026-08-19T11:03:00.000Z', data: { attemptId, outcome: 'completed', probability: 0.75, diceCount: 2 } },
  ]), { receivedAt });
  const summary = reduceAnalyticsBatch(null, validated);

  assert.equal(summary.activeSeconds, 60);
  assert.equal(summary.attempts[0].outcome, 'completed');
  assert.equal(summary.attempts[0].actionCounts.move, 2);
  assert.equal(summary.attempts[0].activeSeconds, 60);
});

test('deduplicates retried batches', () => {
  const validated = validateAnalyticsBatch(batch([
    { type: 'interaction', at: '2026-08-19T11:00:00.000Z', data: { name: 'settings', outcome: 'opened' } },
  ]), { receivedAt });
  const once = reduceAnalyticsBatch(null, validated);
  const twice = reduceAnalyticsBatch(once, validated);
  assert.equal(twice.interactions['settings:opened'], 1);
});

test('accepts Tutorial stage positions while rejecting generic analytics events', () => {
  const validated = validateAnalyticsBatch(batch([
    { type: 'series-started', at: '2026-08-19T11:00:00.000Z', data: { runId, seriesId: 'tutorial-series' } },
    { type: 'series-advanced', at: '2026-08-19T11:05:00.000Z', data: { runId, scenarioId: 'scenario-001', position: 1 } },
  ]), { receivedAt });
  assert.equal(validated.events[1].data.position, 1);

  assert.throws(() => validateAnalyticsBatch(batch([
    { type: 'interaction', at: '2026-08-19T11:00:00.000Z', data: { name: 'pageview', outcome: 'viewed' } },
  ]), { receivedAt }), AnalyticsValidationError);
  assert.throws(() => validateAnalyticsBatch(batch([
    { type: 'interaction', at: '2026-08-19T11:00:00.000Z', data: { name: 'settings', outcome: 'opened', utm_source: 'newsletter' } },
  ]), { receivedAt }), AnalyticsValidationError);
});

test('accepts privacy-safe Tutorial guide milestones and groups them by stage', () => {
  const validated = validateAnalyticsBatch(batch([
    {
      type: 'interaction', at: '2026-08-19T11:00:00.000Z',
      data: {
        name: 'tutorial-guide', outcome: 'hint-requested',
        scenarioId: 'scenario-001', stageId: 'movement-plot-route',
      },
    },
  ]), { receivedAt });
  const summary = reduceAnalyticsBatch(null, validated);

  assert.equal(validated.events[0].data.scenarioId, 'scenario-001');
  assert.equal(validated.events[0].data.stageId, 'movement-plot-route');
  assert.equal(summary.interactions['tutorial-guide:scenario-001:movement-plot-route:hint-requested'], 1);

  assert.throws(() => validateAnalyticsBatch(batch([
    {
      type: 'interaction', at: '2026-08-19T11:00:00.000Z',
      data: {
        name: 'tutorial-guide', outcome: 'shown',
        scenarioId: 'scenario-001', stageId: 'movement-plot-route', route: [{ col: 7, row: 4 }],
      },
    },
  ]), { receivedAt }), AnalyticsValidationError);
});

test('rejects direct identity and move-log fields', () => {
  assert.throws(() => validateAnalyticsBatch(batch([
    { type: 'interaction', at: '2026-08-19T11:00:00.000Z', data: { name: 'settings', email: 'person@example.com' } },
  ]), { receivedAt }), AnalyticsValidationError);
  assert.throws(() => validateAnalyticsBatch({ ...batch([]), playLog: [] }, { receivedAt }), AnalyticsValidationError);
});
