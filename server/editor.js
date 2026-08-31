import { readdir, readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { join, basename } from 'path';
import { AdminAuthError, configuredAdminCount, requireAdminGoogleUser, requireVerifiedGoogleUser } from './auth.js';
import { addManagedAdmin, normalizeAdminEmail, removeManagedAdmin } from '../shared/adminManagement.js';
import { readAdminAudit, readManagedAdmins, saveManagedAdminsWithAudit } from './adminStore.js';
import {
  SCENARIO_ID_RE,
  normalizeScenario,
  normalizeSeries,
  normalizeSeriesCollection,
  validateScenario,
} from '../shared/scenarioValidation.js';

const ROOT = join(process.cwd(), '..');
const SCENARIO_DIR = join(ROOT, 'client/src/scenarios');
const SERIES_DIR = join(ROOT, 'client/src/series');

function jsonResponse(res, status, body) {
  res.status(status).json(body);
}

function scenarioPath(id) {
  return join(SCENARIO_DIR, `${id}.json`);
}

/** Rejects anything that isn't a bare, well-formed scenario id (no traversal). */
function safeScenarioId(raw) {
  const id = String(raw);
  return basename(id) === id && SCENARIO_ID_RE.test(id) ? id : null;
}

/** Runs `handler` only for an allowlisted admin; otherwise writes the auth error. */
async function withAdmin(req, res, handler) {
  try {
    await requireAdminGoogleUser(req);
  } catch (error) {
    if (error instanceof AdminAuthError) return jsonResponse(res, error.status, { errors: [error.message] });
    throw error;
  }
  return handler();
}

/** Management always needs a verified actor, including legacy open local dev. */
async function withAdminManager(req, res, handler) {
  try {
    const user = await requireAdminGoogleUser(req);
    return handler(user ?? await requireVerifiedGoogleUser(req));
  } catch (error) {
    if (error instanceof AdminAuthError) return jsonResponse(res, error.status, { errors: [error.message] });
    throw error;
  }
}

async function readScenarios() {
  const files = await readdir(SCENARIO_DIR);
  const jsonFiles = files.filter(file => file.endsWith('.json')).sort();
  return Promise.all(jsonFiles.map(async file => {
    const raw = await readFile(join(SCENARIO_DIR, file), 'utf8');
    return JSON.parse(raw);
  }));
}

async function readSeries() {
  try {
    const files = (await readdir(SERIES_DIR)).filter(file => file.endsWith('.json')).sort();
    return normalizeSeriesCollection(await Promise.all(files.map(async file =>
      JSON.parse(await readFile(join(SERIES_DIR, file), 'utf8')),
    )));
  } catch {
    return [];
  }
}

async function writeSeries(series) {
  await mkdir(SERIES_DIR, { recursive: true });
  await writeFile(join(SERIES_DIR, `${series.id}.json`), `${JSON.stringify(series, null, 2)}\n`);
}

/**
 * The published view players get. Local dev has no draft/published split — the
 * editor writes straight to these JSON files — so this is the same read
 * filtered to `published !== false`, with series ids narrowed to scenarios that
 * actually survive that filter (otherwise Series Play would silently skip a
 * puzzle mid-run). Exported so /api/progress can reuse it.
 */
export async function readPublicScenarios() {
  const [allScenarios, series] = await Promise.all([readScenarios(), readSeries()]);
  const scenarios = allScenarios.filter(scenario => scenario.published !== false);
  const publishedIds = new Set(scenarios.map(scenario => scenario.id));
  return {
    scenarios,
    series: series
      .filter(item => item.published !== false)
      .map(item => ({ ...item, scenarioIds: item.scenarioIds.filter(id => publishedIds.has(id)) })),
  };
}

export function registerEditorRoutes(app) {
  // Deliberately returns only a boolean capability, never the allowlist. The
  // client uses this to decide whether to reveal Puzzle Creator navigation.
  app.get('/api/editor/access', async (req, res) => withAdmin(req, res, async () => {
    res.set({ 'Cache-Control': 'private, no-store', Vary: 'Authorization' });
    jsonResponse(res, 200, { isAdmin: true });
  }));

  app.get('/api/editor/admins', async (req, res) => withAdminManager(req, res, async () => {
    const managedAdmins = await readManagedAdmins();
    jsonResponse(res, 200, { managedAdmins, configuredAdminCount, audit: await readAdminAudit() });
  }));

  app.post('/api/editor/admins', async (req, res) => withAdminManager(req, res, async user => {
    try {
      const target = normalizeAdminEmail(req.body?.email);
      const saved = await saveManagedAdminsWithAudit(addManagedAdmin(await readManagedAdmins(), target), { action: 'added', actor: user.email, target });
      jsonResponse(res, 200, { ...saved, configuredAdminCount });
    } catch (error) {
      jsonResponse(res, 400, { errors: [error instanceof Error ? error.message : 'Could not add administrator'] });
    }
  }));

  app.delete('/api/editor/admins', async (req, res) => withAdminManager(req, res, async user => {
    try {
      const current = await readManagedAdmins();
      const managedAdmins = removeManagedAdmin(current, req.query.email);
      if (configuredAdminCount === 0 && managedAdmins.length === 0 && current.length > 0) {
        return jsonResponse(res, 400, { errors: ['Keep at least one managed administrator, or configure ADMIN_EMAILS.'] });
      }
      if (managedAdmins.length === current.length) {
        return jsonResponse(res, 404, { errors: ['That administrator is managed by deployment configuration or does not exist.'] });
      }
      const saved = await saveManagedAdminsWithAudit(managedAdmins, { action: 'removed', actor: user.email, target: normalizeAdminEmail(req.query.email) });
      jsonResponse(res, 200, { ...saved, configuredAdminCount });
    } catch (error) {
      jsonResponse(res, 400, { errors: [error instanceof Error ? error.message : 'Could not remove administrator'] });
    }
  }));

  // Drafts include unpublished puzzles, so this needs the same admin gate as
  // the write routes — an open read here would leak work in progress.
  app.get('/api/editor/scenarios', async (req, res) => withAdmin(req, res, async () => {
    const [scenarios, series] = await Promise.all([readScenarios(), readSeries()]);
    jsonResponse(res, 200, { scenarios, series });
  }));

  // Public read endpoint mirroring netlify/functions/scenarios.js.
  app.get('/api/scenarios', async (_req, res) => {
    res.set('Cache-Control', 'public, max-age=60');
    jsonResponse(res, 200, await readPublicScenarios());
  });

  app.post('/api/editor/scenarios', async (req, res) => withAdmin(req, res, async () => {
    const existing = await readScenarios();
    const existingIds = new Set(existing.map(scenario => scenario.id));
    const scenario = normalizeScenario(req.body);
    const errors = validateScenario(scenario, existingIds);
    if (errors.length) return jsonResponse(res, 400, { errors });
    if (!safeScenarioId(scenario.id)) return jsonResponse(res, 400, { errors: ['Invalid scenario id'] });
    await writeFile(scenarioPath(scenario.id), `${JSON.stringify(scenario, null, 2)}\n`);
    jsonResponse(res, 201, scenario);
  }));

  app.put('/api/editor/scenarios/:scenarioId', async (req, res) => withAdmin(req, res, async () => {
    const id = safeScenarioId(req.params.scenarioId);
    if (!id) return jsonResponse(res, 400, { errors: ['Invalid scenario id'] });
    const scenario = normalizeScenario({ ...req.body, id });
    const errors = validateScenario(scenario, new Set(), { allowExisting: true });
    if (errors.length) return jsonResponse(res, 400, { errors });
    await writeFile(scenarioPath(id), `${JSON.stringify(scenario, null, 2)}\n`);
    jsonResponse(res, 200, scenario);
  }));

  app.delete('/api/editor/scenarios/:scenarioId', async (req, res) => withAdmin(req, res, async () => {
    const id = safeScenarioId(req.params.scenarioId);
    if (!id) return jsonResponse(res, 400, { errors: ['Invalid scenario id'] });

    const scenarios = await readScenarios();
    if (!scenarios.some(scenario => scenario.id === id)) return jsonResponse(res, 404, { errors: ['Scenario not found'] });

    await unlink(scenarioPath(id));
    const remainingScenarios = scenarios.filter(scenario => scenario.id !== id);
    const currentSeries = await readSeries();
    const savedSeries = currentSeries.map(item => ({
      ...item,
      scenarioIds: item.scenarioIds.filter(scenarioId => scenarioId !== id),
    }));
    await Promise.all(savedSeries.map(writeSeries));
    jsonResponse(res, 200, { scenarios: remainingScenarios, series: savedSeries });
  }));

  async function saveSeriesRequest(req, res, creating) {
    const scenarios = await readScenarios();
    const scenarioIds = new Set(scenarios.map(scenario => scenario.id));
    const series = normalizeSeries({ ...req.body, id: req.params.seriesId ?? req.body?.id });
    if (!safeScenarioId(series.id)) return jsonResponse(res, 400, { errors: ['Invalid series id'] });
    const existing = await readSeries();
    if (creating && existing.some(item => item.id === series.id)) return jsonResponse(res, 409, { errors: ['Series id already exists'] });
    const missing = series.scenarioIds.filter(id => !scenarioIds.has(id));
    if (missing.length) return jsonResponse(res, 400, { errors: missing.map(id => `Missing scenario: ${id}`) });
    await writeSeries(series);
    jsonResponse(res, creating ? 201 : 200, series);
  }

  app.post('/api/editor/series', async (req, res) => withAdmin(req, res, () => saveSeriesRequest(req, res, true)));
  app.put('/api/editor/series/:seriesId', async (req, res) => withAdmin(req, res, () => saveSeriesRequest(req, res, false)));
  app.delete('/api/editor/series/:seriesId', async (req, res) => withAdmin(req, res, async () => {
    const id = safeScenarioId(req.params.seriesId);
    if (!id) return jsonResponse(res, 400, { errors: ['Invalid series id'] });
    const existing = await readSeries();
    if (!existing.some(item => item.id === id)) return jsonResponse(res, 404, { errors: ['Series not found'] });
    await unlink(join(SERIES_DIR, `${id}.json`));
    jsonResponse(res, 200, existing.filter(item => item.id !== id));
  }));

  app.put('/api/editor/series-assignment', async (req, res) => withAdmin(req, res, async () => {
    const scenarioId = safeScenarioId(req.body?.scenarioId);
    const seriesId = req.body?.seriesId ? safeScenarioId(req.body.seriesId) : '';
    if (!scenarioId || (req.body?.seriesId && !seriesId)) return jsonResponse(res, 400, { errors: ['Invalid assignment'] });
    const [scenarios, existing] = await Promise.all([readScenarios(), readSeries()]);
    if (!scenarios.some(item => item.id === scenarioId)) return jsonResponse(res, 404, { errors: ['Scenario not found'] });
    if (seriesId && !existing.some(item => item.id === seriesId)) return jsonResponse(res, 404, { errors: ['Series not found'] });
    const saved = existing.map(item => {
      const without = item.scenarioIds.filter(id => id !== scenarioId);
      return item.id === seriesId ? { ...item, scenarioIds: [...without, scenarioId] } : { ...item, scenarioIds: without };
    });
    await Promise.all(saved.map(writeSeries));
    jsonResponse(res, 200, saved);
  }));

  // Local dev writes straight to the scenario/series JSON files players read,
  // so there's no separate draft/published split here — this endpoint exists
  // only so the client can call the same publish() action in both
  // environments. See netlify/functions/editor-publish.js for the Netlify
  // equivalent, which actually copies Blobs draft state to a published key.
  app.post('/api/editor/publish', async (req, res) => withAdmin(req, res, async () => {
    const [scenarios, series] = await Promise.all([readScenarios(), readSeries()]);
    jsonResponse(res, 200, { scenarios, series });
  }));
}
