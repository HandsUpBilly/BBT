import { readdir, readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { join, basename } from 'path';
import { AdminAuthError, configuredAdminCount, requireAdminGoogleUser, requireVerifiedGoogleUser } from './auth.js';
import { addManagedAdmin, normalizeAdminEmail, removeManagedAdmin } from '../shared/adminManagement.js';
import { readAdminAudit, readManagedAdmins, saveManagedAdminsWithAudit } from './adminStore.js';
import {
  SCENARIO_ID_RE,
  normalizeScenario,
  normalizeSeries,
  validateScenario,
} from '../shared/scenarioValidation.js';

const ROOT = join(process.cwd(), '..');
const SCENARIO_DIR = join(ROOT, 'client/src/scenarios');
const SERIES_DIR = join(ROOT, 'client/src/series');
const DEFAULT_SERIES_PATH = join(SERIES_DIR, 'default.json');

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

async function readDefaultSeries() {
  try {
    return normalizeSeries(JSON.parse(await readFile(DEFAULT_SERIES_PATH, 'utf8')));
  } catch {
    return { id: 'default', name: 'Default Series', description: '', scenarioIds: [] };
  }
}

/**
 * The published view players get. Local dev has no draft/published split — the
 * editor writes straight to these JSON files — so this is the same read
 * filtered to `published !== false`, with series ids narrowed to scenarios that
 * actually survive that filter (otherwise Series Play would silently skip a
 * puzzle mid-run). Exported so /api/progress can reuse it.
 */
export async function readPublicScenarios() {
  const [allScenarios, series] = await Promise.all([readScenarios(), readDefaultSeries()]);
  const scenarios = allScenarios.filter(scenario => scenario.published !== false);
  const publishedIds = new Set(scenarios.map(scenario => scenario.id));
  return {
    scenarios,
    series: { ...series, scenarioIds: series.scenarioIds.filter(id => publishedIds.has(id)) },
  };
}

export function registerEditorRoutes(app) {
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

  app.delete('/api/editor/admins/:email', async (req, res) => withAdminManager(req, res, async user => {
    try {
      const current = await readManagedAdmins();
      const managedAdmins = removeManagedAdmin(current, req.params.email);
      if (configuredAdminCount === 0 && managedAdmins.length === 0 && current.length > 0) {
        return jsonResponse(res, 400, { errors: ['Keep at least one managed administrator, or configure ADMIN_EMAILS.'] });
      }
      if (managedAdmins.length === current.length) {
        return jsonResponse(res, 404, { errors: ['That administrator is managed by deployment configuration or does not exist.'] });
      }
      const saved = await saveManagedAdminsWithAudit(managedAdmins, { action: 'removed', actor: user.email, target: normalizeAdminEmail(req.params.email) });
      jsonResponse(res, 200, { ...saved, configuredAdminCount });
    } catch (error) {
      jsonResponse(res, 400, { errors: [error instanceof Error ? error.message : 'Could not remove administrator'] });
    }
  }));

  // Drafts include unpublished puzzles, so this needs the same admin gate as
  // the write routes — an open read here would leak work in progress.
  app.get('/api/editor/scenarios', async (req, res) => withAdmin(req, res, async () => {
    const [scenarios, series] = await Promise.all([readScenarios(), readDefaultSeries()]);
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
    const currentSeries = await readDefaultSeries();
    const savedSeries = {
      ...currentSeries,
      scenarioIds: currentSeries.scenarioIds.filter(scenarioId => scenarioId !== id),
    };
    await mkdir(SERIES_DIR, { recursive: true });
    await writeFile(DEFAULT_SERIES_PATH, `${JSON.stringify(savedSeries, null, 2)}\n`);
    jsonResponse(res, 200, { scenarios: remainingScenarios, series: savedSeries });
  }));

  app.put('/api/editor/series/default', async (req, res) => withAdmin(req, res, async () => {
    const scenarios = await readScenarios();
    const scenarioIds = new Set(scenarios.map(scenario => scenario.id));
    const series = normalizeSeries(req.body);
    const missing = series.scenarioIds.filter(id => !scenarioIds.has(id));
    if (missing.length) return jsonResponse(res, 400, { errors: missing.map(id => `Missing scenario: ${id}`) });
    await mkdir(SERIES_DIR, { recursive: true });
    await writeFile(DEFAULT_SERIES_PATH, `${JSON.stringify(series, null, 2)}\n`);
    jsonResponse(res, 200, series);
  }));

  // Local dev writes straight to the scenario/series JSON files players read,
  // so there's no separate draft/published split here — this endpoint exists
  // only so the client can call the same publish() action in both
  // environments. See netlify/functions/editor-publish.js for the Netlify
  // equivalent, which actually copies Blobs draft state to a published key.
  app.post('/api/editor/publish', async (req, res) => withAdmin(req, res, async () => {
    const [scenarios, series] = await Promise.all([readScenarios(), readDefaultSeries()]);
    jsonResponse(res, 200, { scenarios, series });
  }));
}
