const DAY_MS = 24 * 60 * 60 * 1000;

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function ratio(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : null;
}

function dayKey(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

function increment(record, key, count = 1) {
  if (!key) return;
  record[key] = (record[key] ?? 0) + count;
}

function bins(values, definitions) {
  return definitions.map(({ label, test }) => ({ label, count: values.filter(test).length }));
}

function inferredAttempt(attempt, session, cutoff) {
  if (attempt.outcome || Date.parse(session.lastSeenAt) > cutoff) return attempt;
  return { ...attempt, endedAt: session.lastSeenAt, outcome: 'inactive/closed' };
}

function inferredRun(run, session, cutoff) {
  if (run.outcome || Date.parse(session.lastSeenAt) > cutoff) return run;
  return { ...run, endedAt: session.lastSeenAt, outcome: 'inactive/closed' };
}

export function buildEngagementAnalytics({ sessions, generatedAt, windowDays = 30 }) {
  const nowIso = generatedAt ?? new Date().toISOString();
  const now = Date.parse(nowIso);
  const start = now - windowDays * DAY_MS;
  const retained = (Array.isArray(sessions) ? sessions : []).filter(session =>
    session && Number.isFinite(Date.parse(session.startedAt)),
  );
  const selected = retained.filter(session => {
    const value = Date.parse(session.startedAt);
    return value >= start && value <= now;
  });
  const inactivityCutoff = now - 30 * 60 * 1000;
  const attempts = selected.flatMap(session => (session.attempts ?? []).map(attempt => ({
    ...inferredAttempt(attempt, session, inactivityCutoff), session,
  })));
  const runs = selected.flatMap(session => (session.seriesRuns ?? []).map(run => ({
    ...inferredRun(run, session, inactivityCutoff), session,
  })));
  const completed = attempts.filter(attempt => attempt.outcome === 'completed');
  const engaged = attempts.filter(attempt => attempt.engagedAt);
  const engagedSessions = selected.filter(session => (session.attempts ?? []).some(attempt => attempt.engagedAt));
  const gameSessions = selected.filter(session => (session.attempts ?? []).length > 0);

  const trend = {};
  for (let cursor = start; cursor <= now; cursor += DAY_MS) {
    trend[new Date(cursor).toISOString().slice(0, 10)] = { gameSessions: 0, engagedSessions: 0, starts: 0, completions: 0 };
  }
  selected.forEach(session => {
    const bucket = trend[dayKey(session.startedAt)];
    if (!bucket) return;
    if ((session.attempts ?? []).length > 0) bucket.gameSessions += 1;
    if ((session.attempts ?? []).some(attempt => attempt.engagedAt)) bucket.engagedSessions += 1;
  });
  attempts.forEach(attempt => {
    const startBucket = trend[dayKey(attempt.startedAt)];
    if (startBucket) startBucket.starts += 1;
    const endBucket = trend[dayKey(attempt.endedAt)];
    if (attempt.outcome === 'completed' && endBucket) endBucket.completions += 1;
  });

  const puzzleMap = new Map();
  attempts.forEach(attempt => {
    if (!puzzleMap.has(attempt.scenarioId)) puzzleMap.set(attempt.scenarioId, {
      scenarioId: attempt.scenarioId,
      scenarioName: attempt.scenarioName || attempt.scenarioId,
      starts: 0, engaged: 0, completions: 0, restarts: 0,
      explicitLeaves: 0, inactive: 0, activeTimes: [], stopDepth: {}, lastActions: {},
    });
    const puzzle = puzzleMap.get(attempt.scenarioId);
    puzzle.starts += 1;
    if (attempt.engagedAt) puzzle.engaged += 1;
    if (attempt.outcome === 'completed') puzzle.completions += 1;
    if (attempt.outcome === 'restarted') puzzle.restarts += 1;
    if (attempt.outcome === 'left-puzzle' || attempt.outcome === 'left-series' || attempt.outcome === 'replaced') puzzle.explicitLeaves += 1;
    if (attempt.outcome === 'inactive/closed') puzzle.inactive += 1;
    if (Number.isFinite(attempt.activeSeconds)) puzzle.activeTimes.push(attempt.activeSeconds);
    if (attempt.outcome !== 'completed') {
      const depth = attempt.committedActions ?? 0;
      const band = depth === 0 ? '0' : depth === 1 ? '1' : depth <= 4 ? '2-4' : depth <= 9 ? '5-9' : '10+';
      increment(puzzle.stopDepth, band);
      increment(puzzle.lastActions, attempt.lastAction ?? 'none');
    }
  });

  const actionCounts = {};
  attempts.forEach(attempt => Object.entries(attempt.actionCounts ?? {}).forEach(([action, count]) => increment(actionCounts, action, count)));
  const outcomeCounts = {};
  attempts.forEach(attempt => increment(outcomeCounts, attempt.outcome ?? 'open'));
  const interactionCounts = {};
  selected.forEach(session => Object.entries(session.interactions ?? {}).forEach(([name, count]) => increment(interactionCounts, name, count)));

  const seriesPositions = {};
  runs.forEach(run => run.stages.forEach(stage => {
    const current = seriesPositions[stage.position] ?? { position: stage.position, scenarioId: stage.scenarioId, completions: 0 };
    current.completions += 1;
    seriesPositions[stage.position] = current;
  }));

  return {
    generatedAt: nowIso,
    windowDays,
    periodStart: new Date(start).toISOString(),
    periodEnd: new Date(now).toISOString(),
    overview: {
      gameSessions: gameSessions.length,
      engagedSessions: engagedSessions.length,
      puzzleStarts: attempts.length,
      puzzleCompletions: completed.length,
      completionRate: ratio(completed.length, attempts.length),
      medianActiveSeconds: median(selected.map(session => session.activeSeconds ?? 0)),
      averagePuzzlesPerSession: gameSessions.length ? attempts.length / gameSessions.length : null,
    },
    funnel: [
      { stage: 'Puzzle Started', count: attempts.length },
      { stage: 'Meaningful Play', count: engaged.length },
      { stage: 'Puzzle Completed', count: completed.length },
    ],
    trend: Object.entries(trend).map(([date, bucket]) => ({ ...bucket, date })),
    activeTimeDistribution: bins(selected.map(session => session.activeSeconds ?? 0), [
      { label: '<1m', test: value => value < 60 },
      { label: '1-5m', test: value => value >= 60 && value < 300 },
      { label: '5-15m', test: value => value >= 300 && value < 900 },
      { label: '15-30m', test: value => value >= 900 && value < 1800 },
      { label: '30m+', test: value => value >= 1800 },
    ]),
    puzzlesPerSessionDistribution: bins(selected.map(session => (session.attempts ?? []).length), [
      { label: '0', test: value => value === 0 },
      { label: '1', test: value => value === 1 },
      { label: '2', test: value => value === 2 },
      { label: '3+', test: value => value >= 3 },
    ]),
    puzzles: [...puzzleMap.values()].map(puzzle => ({
      ...puzzle,
      completionRate: ratio(puzzle.completions, puzzle.starts),
      medianActiveSeconds: median(puzzle.activeTimes),
      activeTimes: undefined,
    })).sort((left, right) => right.starts - left.starts),
    seriesFunnel: {
      starts: runs.length,
      stages: Object.values(seriesPositions).sort((left, right) => left.position - right.position),
      completions: runs.filter(run => run.outcome === 'completed').length,
      outcomes: runs.reduce((result, run) => { increment(result, run.outcome ?? 'open'); return result; }, {}),
    },
    actions: Object.entries(actionCounts).map(([name, count]) => ({ name, count, perEngagedAttempt: engaged.length ? count / engaged.length : null })).sort((left, right) => right.count - left.count),
    outcomes: Object.entries(outcomeCounts).map(([name, count]) => ({ name, count })),
    interactions: Object.entries(interactionCounts).map(([name, count]) => ({ name, count })).sort((left, right) => right.count - left.count),
  };
}
