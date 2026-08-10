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
  ScoreValidationError,
  sortEntries,
  upsertPersonalBest,
  validateScoreSubmission,
  validateSeriesSubmission,
} from '../shared/scoreValidation.js';
import {
  LEADERBOARD_RATE_LIMIT,
  REPORT_RATE_LIMIT,
  createRateLimiter,
  rateLimitKey,
} from '../shared/rateLimit.js';
import { buildPlayerStatistics } from '../shared/statistics.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const distPath = join(__dirname, '../client/dist');
const isProd = existsSync(distPath);

// Leaderboards return at most this many rows. The full list is retained in the
// store — only the read is truncated — so a player who drops out of the visible
// table still has their personal best on record.
const TOP_N = 20;

app.use(express.json({ limit: '256kb' }));
registerEditorRoutes(app);

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

app.get('/api/leaderboard/:scenarioId', (req, res) => {
  res.json(sortEntries(getBoard(req.params.scenarioId)).slice(0, TOP_N));
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

app.get('/api/series-leaderboard', (_req, res) => {
  res.json(sortEntries(seriesBoard).slice(0, TOP_N));
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
  return res.json(buildPlayerStatistics({ scenarios, scenarioBoards, seriesEntries: seriesBoard }));
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
