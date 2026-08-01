import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { AuthError, entryAuthFields, verifyOptionalGoogleUser } from './auth.js';
import { registerEditorRoutes } from './editor.js';
import {
  ReportConfigurationError,
  ReportDeliveryError,
  ReportValidationError,
  buildIssueDraft,
  createDownload,
  createGitHubIssue,
  resolveReporterName,
  validateReportPayload,
} from './reporting.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const distPath = join(__dirname, '../client/dist');
const isProd = existsSync(distPath);

app.use(express.json());
registerEditorRoutes(app);

// Serve built client in production only
if (isProd) {
  app.use(express.static(distPath));
}

// ── In-memory leaderboard ────────────────────────────────────────────────────
const store = new Map();

function getBoard(scenarioId) {
  if (!store.has(scenarioId)) store.set(scenarioId, []);
  return store.get(scenarioId);
}

app.get('/api/leaderboard/:scenarioId', (req, res) => {
  const top20 = [...getBoard(req.params.scenarioId)]
    .sort((a, b) => b.probability - a.probability || a.diceCount - b.diceCount)
    .slice(0, 20);
  res.json(top20);
});

app.post('/api/leaderboard/:scenarioId', async (req, res) => {
  let user = null;
  try {
    user = await verifyOptionalGoogleUser(req);
  } catch (error) {
    if (error instanceof AuthError) return res.status(401).json({ error: error.message });
    throw error;
  }

  const { name, probability, diceCount } = req.body;
  if ((!name && !user) || probability == null || diceCount == null)
    return res.status(400).json({ error: 'name, probability and diceCount are required' });
  const entry = {
    id: randomUUID(),
    scenarioId: req.params.scenarioId,
    name: String(user?.name ?? name).slice(0, 32),
    probability: Number(probability),
    diceCount: Number(diceCount),
    date: new Date().toISOString(),
    ...entryAuthFields(user),
  };
  const board = getBoard(req.params.scenarioId);
  const idx = user
    ? board.findIndex(e => e.userId === user.providerUserId)
    : -1;
  if (idx >= 0) board[idx] = entry;
  else board.push(entry);
  res.status(201).json(entry);
});

// ── In-memory series leaderboard ────────────────────────────────────────────
const seriesBoard = [];

app.get('/api/series-leaderboard', (_req, res) => {
  const top20 = [...seriesBoard]
    .sort((a, b) => b.probability - a.probability || a.diceCount - b.diceCount)
    .slice(0, 20);
  res.json(top20);
});

app.post('/api/series-leaderboard', async (req, res) => {
  let user = null;
  try {
    user = await verifyOptionalGoogleUser(req);
  } catch (error) {
    if (error instanceof AuthError) return res.status(401).json({ error: error.message });
    throw error;
  }

  const { name, probability, diceCount, puzzles } = req.body;
  if ((!name && !user) || probability == null || diceCount == null)
    return res.status(400).json({ error: 'name, probability and diceCount are required' });
  const entry = {
    id: randomUUID(),
    name: String(user?.name ?? name).slice(0, 32),
    probability: Number(probability),
    diceCount: Number(diceCount),
    date: new Date().toISOString(),
    puzzles: Array.isArray(puzzles) ? puzzles : [],
    ...entryAuthFields(user),
  };
  const idx = user
    ? seriesBoard.findIndex(e => e.userId === user.providerUserId)
    : seriesBoard.findIndex(e => e.name === entry.name);
  if (idx >= 0) seriesBoard[idx] = entry;
  else seriesBoard.push(entry);
  res.status(201).json(entry);
});

// ── Player issue and feature reports ────────────────────────────────────────
app.post('/api/reports', async (req, res) => {
  let user = null;
  try {
    user = await verifyOptionalGoogleUser(req);
  } catch (error) {
    if (error instanceof AuthError) return res.status(401).json({ error: error.message });
    throw error;
  }

  let report;
  let reporterName;
  try {
    report = validateReportPayload(req.body);
    reporterName = resolveReporterName(report, user);
  } catch (error) {
    if (error instanceof ReportValidationError) return res.status(400).json({ error: error.message });
    throw error;
  }

  const draft = buildIssueDraft(report, reporterName);
  const download = createDownload(report, reporterName);
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
  return next(error);
});

app.listen(PORT, () =>
  console.log(`Server on http://localhost:${PORT} (${isProd ? 'production' : 'dev API only'})`)
);
