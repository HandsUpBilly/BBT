import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEngagementAnalytics } from './analyticsStatistics.js';

function session(id, startedAt, attempts = [], extra = {}) {
  return {
    schemaVersion: 1, sessionId: id, startedAt,
    lastSeenAt: startedAt, activeSeconds: 120, attempts, seriesRuns: [], interactions: {}, ...extra,
  };
}

test('builds a session funnel and distinguishes completion from abandonment', () => {
  const now = '2026-08-19T12:00:00.000Z';
  const sessions = [
    session('s1', '2026-08-18T10:00:00.000Z', [{
      id: 'a1', scenarioId: 'scenario-001', scenarioName: 'Opening Drive', startedAt: '2026-08-18T10:01:00.000Z',
      engagedAt: '2026-08-18T10:02:00.000Z', endedAt: '2026-08-18T10:03:00.000Z', outcome: 'completed', activeSeconds: 60,
      actionCounts: { move: 2 }, committedActions: 2, activatedPieces: 1, lastAction: 'move',
    }]),
    session('s2', '2026-08-19T10:00:00.000Z', [{
      id: 'a2', scenarioId: 'scenario-001', scenarioName: 'Opening Drive', startedAt: '2026-08-19T10:01:00.000Z',
      engagedAt: null, endedAt: null, outcome: null, activeSeconds: 0, actionCounts: {}, committedActions: 0, activatedPieces: 0, lastAction: null,
    }]),
  ];
  const result = buildEngagementAnalytics({ sessions, generatedAt: now, windowDays: 7 });

  assert.equal(result.overview.gameSessions, 2);
  assert.equal(result.overview.puzzleCompletions, 1);
  assert.equal(result.puzzles[0].inactive, 1);
  assert.deepEqual(result.funnel.map(stage => stage.count), [2, 1, 1]);
});
