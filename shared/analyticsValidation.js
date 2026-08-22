/**
 * Dependency-free validation and session reduction for first-party analytics.
 * This module is shared by Express and Netlify; package imports belong in the
 * target-specific storage/auth modules, never here.
 */

export const ANALYTICS_SCHEMA_VERSION = 1;
export const ANALYTICS_LIMITS = Object.freeze({
  maxEventsPerBatch: 50,
  maxProcessedBatches: 256,
  maxAttemptsPerSession: 100,
  maxSeriesRunsPerSession: 20,
  maxStringLength: 100,
  maxQueuedAgeMs: 7 * 24 * 60 * 60 * 1000,
  maxFutureSkewMs: 5 * 60 * 1000,
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SCENARIO_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const EVENT_TYPES = new Set([
  'active-time',
  'puzzle-started', 'puzzle-engaged', 'puzzle-action', 'puzzle-ended',
  'puzzle-restarted', 'series-started', 'series-advanced', 'series-ended',
  'interaction',
]);
const MODES = new Set(['standalone', 'series']);
const ACTIONS = new Set([
  'select', 'move', 'dodge', 'rush', 'pickup', 'handoff', 'pass', 'catch',
  'block', 'blitz', 'activation-cancel', 'action-cancel', 'universe-split',
  'universe-complete', 'universe-give-up',
]);
const PUZZLE_OUTCOMES = new Set(['completed', 'restarted', 'left-puzzle', 'left-series', 'replaced']);
const SERIES_OUTCOMES = new Set(['completed', 'left', 'replaced']);
const INTERACTION_RULES = new Map([
  ['about', { outcomes: new Set(['opened', 'closed']) }],
  ['settings', { outcomes: new Set(['opened', 'closed']) }],
  ['report-dialog', { outcomes: new Set(['opened', 'closed']) }],
  ['report-submit', { outcomes: new Set(['succeeded', 'failed']), values: new Set(['issue', 'feature']) }],
  ['score-submit', { outcomes: new Set(['attempted', 'succeeded', 'failed', 'skipped']) }],
  ['series-score-submit', { outcomes: new Set(['attempted', 'succeeded', 'failed']) }],
  ['tutorial-briefing', { outcomes: new Set(['shown', 'dismissed', 'returned-to-menu']), values: new Set(['continue', 'disable-future']) }],
  ['tutorial-guide', { outcomes: new Set(['shown', 'dismissed', 'stage-reached', 'hint-requested', 'contradiction', 'skipped', 'completed']), guideContext: true }],
  ['setting-avatar', { outcomes: new Set(['changed']), booleanValue: true }],
  ['setting-token-style', { outcomes: new Set(['changed']), values: new Set(['portrait', 'simple', 'plain']) }],
  ['setting-pitch-surface', { outcomes: new Set(['changed']), values: new Set(['grass', 'slate']) }],
  ['setting-coordinates', { outcomes: new Set(['changed']), booleanValue: true }],
  ['setting-tutorial-guidance', { outcomes: new Set(['changed']), booleanValue: true }],
  ['leaderboard', { outcomes: new Set(['opened', 'closed']) }],
  ['game-tools', { outcomes: new Set(['opened', 'closed']) }],
  ['legend', { outcomes: new Set(['opened', 'closed']) }],
  ['action-log', { outcomes: new Set(['opened', 'closed']) }],
  ['mobile-info', { outcomes: new Set(['opened', 'closed']) }],
]);
const FORBIDDEN_KEYS = new Set([
  'email', 'googleid', 'guestalias', 'userid', 'ip', 'useragent', 'moves',
  'playlog', 'route', 'boardstate', 'reportername', 'title', 'description',
  'pieceid', 'piecename', 'coordinates', 'browserid', 'visitorid', 'identity',
  'referrer', 'referer', 'campaign', 'utm', 'utmsource', 'utmmedium',
  'utmcampaign', 'device', 'devicetype', 'browser', 'operatingsystem', 'os',
  'country', 'city', 'location', 'url', 'path', 'page', 'screen', 'pageview',
  'screenview',
]);

export class AnalyticsValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AnalyticsValidationError';
  }
}

function fail(message) {
  throw new AnalyticsValidationError(message);
}

function assertNoForbiddenKeys(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.replaceAll('_', '').toLowerCase())) fail(`Analytics payload contains forbidden field: ${key}`);
    assertNoForbiddenKeys(child);
  }
}

function enumValue(value, allowed, label) {
  if (typeof value !== 'string' || !allowed.has(value)) fail(`${label} is invalid`);
  return value;
}

function shortString(value, label, { optional = false, lower = false, pattern } = {}) {
  if ((value === undefined || value === null || value === '') && optional) return null;
  if (typeof value !== 'string') fail(`${label} must be a string`);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > ANALYTICS_LIMITS.maxStringLength) fail(`${label} is invalid`);
  const normalized = lower ? trimmed.toLowerCase() : trimmed;
  if (pattern && !pattern.test(normalized)) fail(`${label} is invalid`);
  return normalized;
}

function uuid(value, label) {
  if (typeof value !== 'string' || !UUID_RE.test(value)) fail(`${label} must be a UUID`);
  return value.toLowerCase();
}

function finiteNumber(value, label, min, max, fallback) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (!Number.isFinite(value) || value < min || value > max) fail(`${label} is invalid`);
  return value;
}

function timestamp(value, label, receivedAt) {
  const parsed = Date.parse(value);
  const now = Date.parse(receivedAt);
  if (!Number.isFinite(parsed)) fail(`${label} must be an ISO timestamp`);
  if (parsed > now + ANALYTICS_LIMITS.maxFutureSkewMs || parsed < now - ANALYTICS_LIMITS.maxQueuedAgeMs) {
    fail(`${label} is outside the accepted queue window`);
  }
  return new Date(parsed).toISOString();
}

function cleanInteraction(data) {
  const name = shortString(data.name, 'interaction name', { lower: true, pattern: /^[a-z0-9-]+$/ });
  const rule = INTERACTION_RULES.get(name);
  if (!rule) fail('interaction name is invalid');
  const outcome = enumValue(data.outcome, rule.outcomes, 'interaction outcome');
  let value = null;
  if (rule.booleanValue) {
    if (typeof data.value !== 'boolean') fail('interaction value is invalid');
    value = data.value;
  } else if (rule.values) {
    if (data.value !== undefined && data.value !== null) {
      value = enumValue(data.value, rule.values, 'interaction value');
    }
  } else if (data.value !== undefined && data.value !== null) {
    fail('interaction value is invalid');
  }
  if (name === 'tutorial-briefing' && outcome === 'dismissed' && value === null) {
    fail('interaction value is invalid');
  }
  if (name === 'tutorial-briefing' && outcome !== 'dismissed' && value !== null) {
    fail('interaction value is invalid');
  }
  if (rule.guideContext) {
    return {
      name,
      outcome,
      value,
      scenarioId: shortString(data.scenarioId, 'scenarioId', { lower: true, pattern: SCENARIO_RE }),
      stageId: shortString(data.stageId, 'tutorial stageId', { lower: true, pattern: SCENARIO_RE }),
    };
  }
  return { name, outcome, value };
}

function cleanEvent(event, receivedAt) {
  if (!event || typeof event !== 'object') fail('events must contain objects');
  const type = enumValue(event.type, EVENT_TYPES, 'event type');
  const at = timestamp(event.at, 'event timestamp', receivedAt);
  const data = event.data && typeof event.data === 'object' ? event.data : {};
  const clean = {};

  if (type === 'active-time') {
    clean.seconds = finiteNumber(data.seconds, 'active seconds', 0, 60);
    clean.attemptId = data.attemptId ? uuid(data.attemptId, 'attemptId') : null;
  }
  if (type.startsWith('puzzle-')) {
    clean.attemptId = uuid(data.attemptId, 'attemptId');
  }
  if (type === 'puzzle-started') {
    clean.scenarioId = shortString(data.scenarioId, 'scenarioId', { lower: true, pattern: SCENARIO_RE });
    clean.scenarioName = shortString(data.scenarioName, 'scenarioName');
    clean.mode = enumValue(data.mode, MODES, 'puzzle mode');
    clean.seriesPosition = data.seriesPosition === undefined || data.seriesPosition === null
      ? null
      : finiteNumber(data.seriesPosition, 'seriesPosition', 1, 100);
  }
  if (type === 'puzzle-action') {
    clean.action = enumValue(data.action, ACTIONS, 'puzzle action');
    clean.count = Math.floor(finiteNumber(data.count, 'action count', 1, 100, 1));
  }
  if (type === 'puzzle-ended' || type === 'puzzle-restarted') {
    clean.outcome = type === 'puzzle-restarted'
      ? 'restarted'
      : enumValue(data.outcome, PUZZLE_OUTCOMES, 'puzzle outcome');
    clean.probability = data.probability === undefined ? null : finiteNumber(data.probability, 'probability', 0, 1);
    clean.diceCount = data.diceCount === undefined ? null : finiteNumber(data.diceCount, 'diceCount', 0, 10000);
    clean.activatedPieces = data.activatedPieces === undefined ? null : Math.floor(finiteNumber(data.activatedPieces, 'activatedPieces', 0, 100));
    clean.committedActions = data.committedActions === undefined ? null : Math.floor(finiteNumber(data.committedActions, 'committedActions', 0, 10000));
    clean.lastAction = data.lastAction === undefined || data.lastAction === null ? null : enumValue(data.lastAction, ACTIONS, 'lastAction');
  }
  if (type.startsWith('series-')) clean.runId = uuid(data.runId, 'runId');
  if (type === 'series-started') clean.seriesId = shortString(data.seriesId, 'seriesId', { lower: true, pattern: SCENARIO_RE });
  if (type === 'series-advanced') {
    clean.scenarioId = shortString(data.scenarioId, 'scenarioId', { lower: true, pattern: SCENARIO_RE });
    clean.position = Math.floor(finiteNumber(data.position, 'position', 1, 100));
  }
  if (type === 'series-ended') clean.outcome = enumValue(data.outcome, SERIES_OUTCOMES, 'series outcome');
  if (type === 'interaction') {
    Object.assign(clean, cleanInteraction(data));
  }
  return { type, at, data: clean };
}

export function validateAnalyticsBatch(input, context = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Analytics payload must be an object');
  assertNoForbiddenKeys(input);
  if (input.schemaVersion !== ANALYTICS_SCHEMA_VERSION) fail('Unsupported analytics schema version');
  const receivedAt = context.receivedAt ?? new Date().toISOString();
  if (!Array.isArray(input.events) || input.events.length === 0 || input.events.length > ANALYTICS_LIMITS.maxEventsPerBatch) {
    fail('Analytics batch has an invalid event count');
  }
  return {
    schemaVersion: ANALYTICS_SCHEMA_VERSION,
    batchId: uuid(input.batchId, 'batchId'),
    sessionId: uuid(input.sessionId, 'sessionId'),
    sessionStartedAt: timestamp(input.sessionStartedAt, 'sessionStartedAt', receivedAt),
    receivedAt,
    events: input.events.map(event => cleanEvent(event, receivedAt)),
  };
}

function findOrAdd(list, id, create, limit) {
  let item = list.find(candidate => candidate.id === id);
  if (!item && list.length < limit) {
    item = create();
    list.push(item);
  }
  return item;
}

export function reduceAnalyticsBatch(existing, batch) {
  const summary = existing ? structuredClone(existing) : {
    schemaVersion: ANALYTICS_SCHEMA_VERSION,
    sessionId: batch.sessionId,
    startedAt: batch.sessionStartedAt,
    lastSeenAt: batch.sessionStartedAt,
    activeSeconds: 0,
    attempts: [],
    seriesRuns: [],
    interactions: {},
    processedBatchIds: [],
  };
  if (summary.sessionId !== batch.sessionId) fail('Analytics batch does not match its session');
  if (summary.processedBatchIds.includes(batch.batchId)) return summary;

  for (const event of batch.events) {
    if (event.at > summary.lastSeenAt) summary.lastSeenAt = event.at;
    const data = event.data;
    if (event.type === 'active-time') {
      summary.activeSeconds += data.seconds;
      const attempt = data.attemptId && summary.attempts.find(item => item.id === data.attemptId);
      if (attempt) attempt.activeSeconds += data.seconds;
    }
    if (event.type === 'puzzle-started') {
      findOrAdd(summary.attempts, data.attemptId, () => ({
        id: data.attemptId,
        scenarioId: data.scenarioId,
        scenarioName: data.scenarioName,
        mode: data.mode,
        seriesPosition: data.seriesPosition,
        startedAt: event.at,
        engagedAt: null,
        endedAt: null,
        outcome: null,
        activeSeconds: 0,
        actionCounts: {},
        committedActions: 0,
        activatedPieces: 0,
        lastAction: null,
        probability: null,
        diceCount: null,
      }), ANALYTICS_LIMITS.maxAttemptsPerSession);
    }
    if (event.type === 'puzzle-engaged') {
      const attempt = summary.attempts.find(item => item.id === data.attemptId);
      if (attempt && !attempt.engagedAt) attempt.engagedAt = event.at;
    }
    if (event.type === 'puzzle-action') {
      const attempt = summary.attempts.find(item => item.id === data.attemptId);
      if (attempt && !attempt.endedAt) {
        attempt.engagedAt ??= event.at;
        attempt.actionCounts[data.action] = (attempt.actionCounts[data.action] ?? 0) + data.count;
        attempt.committedActions += data.count;
        attempt.lastAction = data.action;
        if (data.action === 'select') attempt.activatedPieces += data.count;
      }
    }
    if (event.type === 'puzzle-ended' || event.type === 'puzzle-restarted') {
      const attempt = summary.attempts.find(item => item.id === data.attemptId);
      if (attempt && !attempt.endedAt) {
        attempt.endedAt = event.at;
        attempt.outcome = data.outcome;
        attempt.probability = data.probability;
        attempt.diceCount = data.diceCount;
        attempt.activatedPieces = data.activatedPieces ?? attempt.activatedPieces;
        attempt.committedActions = data.committedActions ?? attempt.committedActions;
        attempt.lastAction = data.lastAction ?? attempt.lastAction;
      }
    }
    if (event.type === 'series-started') {
      findOrAdd(summary.seriesRuns, data.runId, () => ({
        id: data.runId, seriesId: data.seriesId, startedAt: event.at,
        endedAt: null, outcome: null, stages: [],
      }), ANALYTICS_LIMITS.maxSeriesRunsPerSession);
    }
    if (event.type === 'series-advanced') {
      const run = summary.seriesRuns.find(item => item.id === data.runId);
      if (run && !run.stages.some(stage => stage.position === data.position)) {
        run.stages.push({ scenarioId: data.scenarioId, position: data.position, at: event.at });
      }
    }
    if (event.type === 'series-ended') {
      const run = summary.seriesRuns.find(item => item.id === data.runId);
      if (run && !run.endedAt) {
        run.endedAt = event.at;
        run.outcome = data.outcome;
      }
    }
    if (event.type === 'interaction') {
      const key = data.name === 'tutorial-guide'
        ? [data.name, data.scenarioId, data.stageId, data.outcome].join(':')
        : [data.name, data.outcome, data.value].filter(value => value !== null && value !== undefined).join(':');
      summary.interactions[key] = (summary.interactions[key] ?? 0) + 1;
    }
  }
  summary.processedBatchIds.push(batch.batchId);
  if (summary.processedBatchIds.length > ANALYTICS_LIMITS.maxProcessedBatches) {
    summary.processedBatchIds = summary.processedBatchIds.slice(-ANALYTICS_LIMITS.maxProcessedBatches);
  }
  return summary;
}
