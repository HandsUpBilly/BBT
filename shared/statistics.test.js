import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlayerStatistics, summarizePerformance } from './statistics.js';

test('summarizePerformance describes personal bests without exposing identities', () => {
  const summary = summarizePerformance([
    { userId: 'google-1', name: 'Alice', probability: 0.5, diceCount: 2, date: '2026-01-01T00:00:00.000Z' },
    { userId: 'google-1', name: 'Alice renamed', probability: 0.75, diceCount: 1, date: '2026-01-03T00:00:00.000Z' },
    { name: ' Guest ', probability: 1, diceCount: 0, date: '2026-01-02T00:00:00.000Z' },
    { name: 'guest', probability: Number.NaN, diceCount: 0 },
  ]);

  assert.deepEqual(summary, {
    recordedPlayers: 2,
    personalBests: 3,
    averageProbability: 0.75,
    medianProbability: 0.75,
    bestProbability: 1,
    averageDiceCount: 1,
    latestScoreAt: '2026-01-03T00:00:00.000Z',
  });
});

test('buildPlayerStatistics aggregates puzzle and series records separately', () => {
  const statistics = buildPlayerStatistics({
    scenarios: [
      { id: 'scenario-001', name: 'Opening Drive' },
      { id: 'scenario-002', name: 'Last Stand' },
    ],
    scenarioBoards: {
      'scenario-001': [
        { userId: 'u1', name: 'Alice', probability: 0.5, diceCount: 2 },
        { name: 'Guest', probability: 1, diceCount: 0 },
      ],
      'scenario-002': [
        { userId: 'u1', name: 'Alice', probability: 0.25, diceCount: 3 },
      ],
    },
    seriesEntries: [
      { userId: 'u2', name: 'Bob', probability: 0.6, diceCount: 5 },
    ],
    generatedAt: '2026-02-01T00:00:00.000Z',
  });

  assert.equal(statistics.generatedAt, '2026-02-01T00:00:00.000Z');
  assert.deepEqual(statistics.totals, {
    recordedPlayers: 3,
    puzzlePersonalBests: 3,
    seriesPersonalBests: 1,
    averageProbability: (0.5 + 1 + 0.25) / 3,
    medianProbability: 0.5,
    averageDiceCount: 5 / 3,
  });
  assert.equal(statistics.puzzles[0].recordedPlayers, 2);
  assert.equal(statistics.puzzles[1].bestProbability, 0.25);
  assert.equal(statistics.series.recordedPlayers, 1);
});

test('empty performance data returns null rates instead of misleading zeroes', () => {
  assert.deepEqual(summarizePerformance([]), {
    recordedPlayers: 0,
    personalBests: 0,
    averageProbability: null,
    medianProbability: null,
    bestProbability: null,
    averageDiceCount: null,
    latestScoreAt: null,
  });
});
