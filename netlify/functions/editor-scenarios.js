import { SCENARIO_ID_RE, normalizeScenario, validateScenario } from '../../shared/scenarioValidation.js';
import { editorStore, readDraftScenarios, writeDraftScenarios, readDraftSeries, writeDraftSeries } from './editorStore.js';
import { AdminAuthError, authErrorResponse, requireAdminGoogleUser } from './auth.js';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function scenarioIdFromPath(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  // Avoid treating the base "editor-scenarios" segment as an id
  if (!last || last === 'editor-scenarios' || last === 'scenarios') return null;
  return last;
}

function requestedScenarioId(url) {
  const id = scenarioIdFromPath(url.pathname) ?? url.searchParams.get('scenarioId');
  return id && SCENARIO_ID_RE.test(id) ? id : null;
}

export default async function handler(req) {
  const url = new URL(req.url);

  // Every method here — including GET — is admin-only. Drafts contain
  // unpublished puzzles, so an open read would leak work in progress.
  try {
    await requireAdminGoogleUser(req);
  } catch (error) {
    if (error instanceof AdminAuthError) return authErrorResponse(error);
    throw error;
  }

  const store = editorStore();

  if (req.method === 'GET') {
    const [scenarios, series] = await Promise.all([
      readDraftScenarios(store),
      readDraftSeries(store),
    ]);
    return jsonResponse(200, { scenarios, series });
  }

  if (req.method === 'POST') {
    let body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { errors: ['Invalid JSON'] });
    }

    const existing = await readDraftScenarios(store);
    const existingIds = new Set(existing.map(s => s.id));
    const scenario = normalizeScenario(body);
    const errors = validateScenario(scenario, existingIds);
    if (errors.length) return jsonResponse(400, { errors });

    await writeDraftScenarios(store, [...existing, scenario]);
    return jsonResponse(201, scenario);
  }

  if (req.method === 'PUT') {
    const id = requestedScenarioId(url);
    if (!id) return jsonResponse(400, { errors: ['Invalid scenario id'] });

    let body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { errors: ['Invalid JSON'] });
    }

    const scenario = normalizeScenario({ ...body, id });
    const errors = validateScenario(scenario, new Set(), { allowExisting: true });
    if (errors.length) return jsonResponse(400, { errors });

    const existing = await readDraftScenarios(store);
    const idx = existing.findIndex(s => s.id === id);
    const updated = idx >= 0
      ? existing.map((s, i) => (i === idx ? scenario : s))
      : [...existing, scenario];
    await writeDraftScenarios(store, updated);
    return jsonResponse(200, scenario);
  }

  if (req.method === 'DELETE') {
    const id = requestedScenarioId(url);
    if (!id) return jsonResponse(400, { errors: ['Invalid scenario id'] });

    const [existing, currentSeries] = await Promise.all([
      readDraftScenarios(store),
      readDraftSeries(store),
    ]);
    if (!existing.some(s => s.id === id)) return jsonResponse(404, { errors: ['Scenario not found'] });

    const scenarios = existing.filter(s => s.id !== id);
    const series = currentSeries.map(item => ({
      ...item,
      scenarioIds: item.scenarioIds.filter(scenarioId => scenarioId !== id),
    }));
    await Promise.all([writeDraftScenarios(store, scenarios), writeDraftSeries(store, series)]);
    return jsonResponse(200, { scenarios, series });
  }

  return jsonResponse(405, { errors: ['Method not allowed'] });
}
