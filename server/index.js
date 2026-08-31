import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import {
  AdminAuthError,
  AuthError,
  entryAuthFields,
  requireAdminGoogleUser,
  verifyOptionalGoogleUser,
} from './auth.js';
import { registerEditorRoutes, readPublicScenarios } from './editor.js';
import {
  ReportValidationError,
  buildIssueDraft,
  createDownload,
  resolveReporterName,
  validateReportPayload,
} from '../shared/reporting.js';
import {
  ReportConfigurationError,
  ReportDeliveryError,
  createGitHubIssue,
} from '../shared/githubIssues.js';
import {
  ContactValidationError,
  buildContactEmail,
  validateContactPayload,
} from '../shared/contactMessage.js';
import {
  ContactConfigurationError,
  ContactDeliveryError,
  sendContactEmail,
} from '../shared/resendEmail.js';
import {
  ScoreValidationError,
  sortEntries,
  upsertPersonalBest,
  validateScoreSubmission,
  validateSeriesSubmission,
} from '../shared/scoreValidation.js';
import {
  CONTACT_RATE_LIMIT,
  LEADERBOARD_RATE_LIMIT,
  LOGIN_RATE_LIMIT,
  REPORT_RATE_LIMIT,
  createRateLimiter,
  rateLimitKey,
} from '../shared/rateLimit.js';
import { buildPlayerStatistics } from '../shared/statistics.js';
import { LoginValidationError, recordLogin, sortLogins, validateLoginPayload } from '../shared/loginTracking.js';
import {
  RankingResetValidationError,
  parseRankingResetTarget,
} from '../shared/rankingReset.js';
import { registerAnalyticsRoutes } from './analytics.js';
import { registerPlayerProfileRoutes } from './profiles.js';
import { enrichEntriesWithProfiles } from './profileStore.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const distPath = join(__dirname, '../client/dist');
const isProd = existsSync(distPath);

// Leaderboards return at most this many rows. The full list is retained in the
// store — only the read is truncated — so a player who drops out of the visible
// table still has their personal best on record.
const TOP_N = 20;

function statisticsWindow(value) {
  const days = Number(value);
  return days === 7 || days === 30 ? days : undefined;
}

app.use(express.json({ limit: '256kb' }));
registerAnalyticsRoutes(app);
registerEditorRoutes(app);
registerPlayerProfileRoutes(app);

// Serve built client in production only
if (isProd) {
  app.use(express.static(distPath));
}

/** Shared 401/400 handling for the identity + payload validation steps. */
async function identify(req, res) {
  try {
    return { user: await verifyOptionalGoogleUser(req) };
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(401).json({ error: error.message });
      return { failed: true };
    }
    throw error;
  }
}

/**
 * Throttling bucket for a request — see rateLimitKey in shared/rateLimit.js,
 * which both this and the Netlify functions now share.
 *
 * Express carries no `x-nf-client-connection-ip`, so `getHeader` is left at its
 * default and the trusted address is `req.ip`, which respects `trust proxy`.
 */
const clientKey = (req, user) => rateLimitKey({ user, remoteAddress: req.ip });

// ── In-memory leaderboard ────────────────────────────────────────────────────
const takeLeaderboardToken = createRateLimiter(LEADERBOARD_RATE_LIMIT);
const store = new Map();

function getBoard(scenarioId) {
  if (!store.has(scenarioId)) store.set(scenarioId, []);
  return store.get(scenarioId);
}

app.get('/api/leaderboard/:scenarioId', async (req, res) => {
  const visible = sortEntries(getBoard(req.params.scenarioId)).slice(0, TOP_N);
  res.json(await enrichEntriesWithProfiles(visible));
});

app.post('/api/leaderboard/:scenarioId', async (req, res) => {
  const { user, failed } = await identify(req, res);
  if (failed) return;

  let score;
  try {
    score = validateScoreSubmission(req.body, user);
  } catch (error) {
    if (error instanceof ScoreValidationError) return res.status(400).json({ error: error.message });
    throw error;
  }

  // Rate-limit after validation so malformed spam can't burn a caller's budget.
  const leaderboardLimit = takeLeaderboardToken(clientKey(req, user));
  if (!leaderboardLimit.allowed) {
    res.set('Retry-After', String(leaderboardLimit.retryAfterSeconds));
    return res.status(429).json({ error: 'Too many submissions. Please wait a moment and try again.' });
  }

  const entry = {
    id: randomUUID(),
    scenarioId: req.params.scenarioId,
    name: score.name,
    probability: score.probability,
    diceCount: score.diceCount,
    date: new Date().toISOString(),
    moves: score.moves,
    ...(score.playLog !== undefined ? { playLog: score.playLog } : {}),
    ...entryAuthFields(user),
  };

  const board = getBoard(req.params.scenarioId);
  const updated = upsertPersonalBest(board, entry, existing =>
    user ? existing.userId === user.providerUserId : !existing.userId && existing.name === entry.name,
  );
  store.set(req.params.scenarioId, updated);

  // Report the entry actually on the board: an unbeaten personal best is kept,
  // so the client highlights the right row instead of one that was discarded.
  const persisted = updated.find(e => e.id === entry.id) ?? updated.find(e =>
    user ? e.userId === user.providerUserId : !e.userId && e.name === entry.name,
  );
  res.status(201).json(persisted ?? entry);
});

// ── In-memory series leaderboard ────────────────────────────────────────────
let seriesBoard = [];

app.get('/api/series-leaderboard', async (_req, res) => {
  const visible = sortEntries(seriesBoard).slice(0, TOP_N);
  res.json(await enrichEntriesWithProfiles(visible));
});

app.post('/api/series-leaderboard', async (req, res) => {
  const { user, failed } = await identify(req, res);
  if (failed) return;

  let score;
  try {
    score = validateSeriesSubmission(req.body, user);
  } catch (error) {
    if (error instanceof ScoreValidationError) return res.status(400).json({ error: error.message });
    throw error;
  }

  // Rate-limit after validation so malformed spam can't burn a caller's budget.
  const seriesLeaderboardLimit = takeLeaderboardToken(clientKey(req, user));
  if (!seriesLeaderboardLimit.allowed) {
    res.set('Retry-After', String(seriesLeaderboardLimit.retryAfterSeconds));
    return res.status(429).json({ error: 'Too many submissions. Please wait a moment and try again.' });
  }

  const entry = {
    id: randomUUID(),
    name: score.name,
    probability: score.probability,
    diceCount: score.diceCount,
    date: new Date().toISOString(),
    puzzles: score.puzzles,
    ...entryAuthFields(user),
  };

  seriesBoard = upsertPersonalBest(seriesBoard, entry, existing =>
    user ? existing.userId === user.providerUserId : !existing.userId && existing.name === entry.name,
  );

  const persisted = seriesBoard.find(e => e.id === entry.id) ?? seriesBoard.find(e =>
    user ? e.userId === user.providerUserId : !e.userId && e.name === entry.name,
  );
  res.status(201).json(persisted ?? entry);
});

async function rankingResetSummary() {
  const { scenarios, series } = await readPublicScenarios();
  const names = new Map(scenarios.map(scenario => [scenario.id, scenario.name]));
  const puzzleIds = [...new Set([...names.keys(), ...store.keys()])].sort();
  const puzzles = puzzleIds.map(id => ({
    id,
    name: names.get(id) ?? id,
    count: getBoard(id).length,
  }));
  const seriesBoards = [{ id: series.id, name: series.name, count: seriesBoard.length }];
  return {
    totalEntries: [...puzzles, ...seriesBoards].reduce((total, board) => total + board.count, 0),
    series: seriesBoards,
    puzzles,
  };
}

async function requireRankingAdmin(req, res) {
  try {
    await requireAdminGoogleUser(req);
    return true;
  } catch (error) {
    if (error instanceof AdminAuthError) {
      res.status(error.status).json({ error: error.message, errors: [error.message] });
      return false;
    }
    throw error;
  }
}

app.get('/api/editor/rankings', async (req, res) => {
  if (!await requireRankingAdmin(req, res)) return;
  res.set({ 'Cache-Control': 'private, no-store', Vary: 'Authorization' });
  res.json(await rankingResetSummary());
});

app.delete('/api/editor/rankings', async (req, res) => {
  if (!await requireRankingAdmin(req, res)) return;
  let target;
  try {
    target = parseRankingResetTarget(req.query.scope, req.query.id);
  } catch (error) {
    if (error instanceof RankingResetValidationError) return res.status(400).json({ error: error.message });
    throw error;
  }

  const before = await rankingResetSummary();
  let removed;
  if (target.scope === 'all') {
    removed = before.totalEntries;
    store.clear();
    seriesBoard = [];
  } else if (target.scope === 'puzzle') {
    const board = before.puzzles.find(item => item.id === target.id);
    if (!board) return res.status(404).json({ error: 'Ranking board not found' });
    removed = board.count;
    store.set(target.id, []);
  } else {
    const board = before.series.find(item => item.id === target.id);
    if (!board) return res.status(404).json({ error: 'Ranking board not found' });
    removed = board.count;
    seriesBoard = [];
  }

  res.set({ 'Cache-Control': 'private, no-store', Vary: 'Authorization' });
  return res.json({ removed, summary: await rankingResetSummary() });
});

// ── Player login tracking ───────────────────────────────────────────────────
// Unlike the leaderboards above, this deliberately keeps each player's handle
// — see shared/loginTracking.js. The client posts here once per app session,
// right after an identity (Google or guest) becomes ready.
let loginEntries = [];
const takeLoginToken = createRateLimiter(LOGIN_RATE_LIMIT);

app.post('/api/logins', async (req, res) => {
  const { user, failed } = await identify(req, res);
  if (failed) return;

  let login;
  try {
    login = validateLoginPayload(req.body);
  } catch (error) {
    if (error instanceof LoginValidationError) return res.status(400).json({ error: error.message });
    throw error;
  }

  const loginLimit = takeLoginToken(clientKey(req, user));
  if (!loginLimit.allowed) {
    res.set('Retry-After', String(loginLimit.retryAfterSeconds));
    return res.status(429).json({ error: 'Too many login attempts. Please wait a moment.' });
  }

  const { entries, entry } = recordLogin(loginEntries, { name: login.name, user }, new Date().toISOString());
  loginEntries = entries;
  res.status(201).json(entry);
});

app.get('/api/editor/logins', async (req, res) => {
  try {
    await requireAdminGoogleUser(req);
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return res.status(error.status).json({ error: error.message, errors: [error.message] });
    }
    throw error;
  }
  res.json(sortLogins(loginEntries));
});

// ── Admin player-performance statistics ────────────────────────────────────
// Uses the full retained personal-best lists, not the truncated public boards.
// Only anonymous aggregates leave the server; player names and move histories
// are deliberately excluded from the response.
app.get('/api/editor/statistics', async (req, res) => {
  try {
    await requireAdminGoogleUser(req);
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return res.status(error.status).json({ error: error.message, errors: [error.message] });
    }
    throw error;
  }

  const { scenarios } = await readPublicScenarios();
  const scenarioBoards = Object.fromEntries(
    scenarios.map(scenario => [scenario.id, getBoard(scenario.id)]),
  );
  return res.json(buildPlayerStatistics({
    scenarios, scenarioBoards, seriesEntries: seriesBoard,
    windowDays: statisticsWindow(req.query.window),
  }));
});

// ── Combined home-screen progress ───────────────────────────────────────────
// One request instead of one-per-scenario plus the series board. Mirrors
// netlify/functions/progress.js.
app.get('/api/progress', async (_req, res) => {
  const { scenarios } = await readPublicScenarios();
  const boards = Object.fromEntries(
    scenarios.map(scenario => [
      scenario.id,
      sortEntries(getBoard(scenario.id)).slice(0, TOP_N),
    ]),
  );
  res.json({ scenarios: boards, series: sortEntries(seriesBoard).slice(0, TOP_N) });
});

// ── Player issue and feature reports ────────────────────────────────────────
const takeReportToken = createRateLimiter(REPORT_RATE_LIMIT);

app.post('/api/reports', async (req, res) => {
  let user = null;
  try {
    user = await verifyOptionalGoogleUser(req);
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
    // A present-but-unverifiable token (e.g. expired after the tab sat idle)
    // shouldn't block a report — the reporter name the form always collects
    // is enough to file one. Degrade to the guest path instead of rejecting.
    user = null;
  }

  let report;
  let reporterName;
  try {
    report = validateReportPayload(req.body);
    reporterName = resolveReporterName(report);
  } catch (error) {
    if (error instanceof ReportValidationError) return res.status(400).json({ error: error.message });
    throw error;
  }

  const draft = buildIssueDraft(report, reporterName);
  const download = createDownload(report, reporterName);

  // Rate-limit after validation so a malformed flood can't consume a bucket,
  // and key on the verified user when we have one so a shared IP doesn't
  // penalize everyone behind it.
  const { allowed, retryAfterSeconds } = takeReportToken(clientKey(req, user));
  if (!allowed) {
    res.set('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      error: 'Too many reports from this session. Try again later, or download the report below.',
      download,
    });
  }

  try {
    const issue = await createGitHubIssue(draft);
    return res.status(201).json(issue);
  } catch (error) {
    if (error instanceof ReportConfigurationError) {
      return res.status(503).json({ error: error.message, download });
    }
    if (error instanceof ReportDeliveryError) {
      return res.status(502).json({ error: error.message, download });
    }
    throw error;
  }
});

// ── Player contact messages ─────────────────────────────────────────────────
// Open to guests too — there is no identity to gate a "get in touch" form on.
const takeContactToken = createRateLimiter(CONTACT_RATE_LIMIT);

app.post('/api/contact', async (req, res) => {
  let contact;
  try {
    contact = validateContactPayload(req.body);
  } catch (error) {
    if (error instanceof ContactValidationError) return res.status(400).json({ error: error.message });
    throw error;
  }

  const { allowed, retryAfterSeconds } = takeContactToken(clientKey(req, null));
  if (!allowed) {
    res.set('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({ error: 'Too many messages from this session. Try again later.' });
  }

  const emailContent = buildContactEmail(contact);
  try {
    const sent = await sendContactEmail(contact, emailContent);
    return res.status(201).json(sent);
  } catch (error) {
    if (error instanceof ContactConfigurationError) return res.status(503).json({ error: error.message });
    if (error instanceof ContactDeliveryError) return res.status(502).json({ error: error.message });
    throw error;
  }
});

// SPA fallback — production only
if (isProd) {
  app.get('*', (_req, res) =>
    res.sendFile(join(distPath, 'index.html'))
  );
}

app.use((error, _req, res, next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  if (res.headersSent) return next(error);
  // Never leak internals to the client; the stack still reaches the dev console.
  console.error('Unhandled API error:', error);
  return res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () =>
  console.log(`Server on http://localhost:${PORT} (${isProd ? 'production' : 'dev API only'})`)
);
