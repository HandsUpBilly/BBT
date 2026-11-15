import { SCENARIO_ID_RE, normalizeScenario, validateScenario } from '../../shared/scenarioValidation.js';
import { editorStore, loadContent } from './editorStore.js';
import { writeContentItem, contentVersions, ContentConflictError } from './contentStore.js';
import { AdminAuthError, authErrorResponse, requireAdminGoogleUser } from './auth.js';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function scenarioIdFromPath(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  const last = segments.at(-1);
  return last && !['editor-scenarios', 'scenarios'].includes(last) && SCENARIO_ID_RE.test(last) ? last : null;
}

function requiredRevision(req) {
  const raw = req.headers.get('If-Match');
  if (raw === null || !/^(0|[1-9][0-9]*)$/.test(raw)) return null;
  const revision = Number(raw);
  return Number.isSafeInteger(revision) ? revision : null;
}

async function mutate(store, kind, id, value, expectedRevision) {
  // writeContentItem internally reads the legacy snapshot only during bootstrap.
  // Revisions are per item; CAS guards the entire update from lost writes.
  try {
    return await writeContentItem(store, async () => {
      const catalog = await loadContent(store);
      return { scenarios: catalog.scenarios, series: catalog.series };
    }, { kind, id, value, expectedRevision });
  } catch (error) {
    if (error instanceof ContentConflictError) return { conflict: error.message };
    throw error;
  }
}

export default async function handler(req) {
  try {
    await requireAdminGoogleUser(req);
  } catch (error) {
    if (error instanceof AdminAuthError) return authErrorResponse(error);
    throw error;
  }
  const store = editorStore();
  const url = new URL(req.url);
  if (req.method === 'GET') {
    const catalog = await loadContent(store);
    return jsonResponse(200, {
      scenarios: catalog.scenarios.map(normalizeScenario),
      series: catalog.series,
      ...contentVersions(catalog),
      history: catalog.history.map(({ before, after, ...metadata }) => metadata),
    });
  }

  if (!['POST', 'PUT', 'DELETE'].includes(req.method)) return jsonResponse(405, { errors: ['Method not allowed'] });
  const expectedRevision = requiredRevision(req);
  if (expectedRevision === null) return jsonResponse(428, { errors: ['Reload the editor to obtain a content revision before saving.'] });

  const catalog = await loadContent(store);
  let id = scenarioIdFromPath(url.pathname) ?? url.searchParams.get('scenarioId');
  let scenario;
  if (req.method !== 'DELETE') {
    let body;
    try { body = await req.json(); } catch { return jsonResponse(400, { errors: ['Invalid JSON'] }); }
    id = req.method === 'POST' ? body?.id : id;
    if (!id || !SCENARIO_ID_RE.test(id)) return jsonResponse(400, { errors: ['Invalid scenario id'] });
    scenario = normalizeScenario({ ...body, id });
    const errors = validateScenario(scenario, new Set(catalog.scenarios.map(item => item.id)), {
      allowExisting: req.method === 'PUT',
    });
    if (errors.length) return jsonResponse(400, { errors });
  }
  if (!id || !SCENARIO_ID_RE.test(id)) return jsonResponse(400, { errors: ['Invalid scenario id'] });
  const existing = catalog.scenarios.find(item => item.id === id);
  if (req.method === 'POST' && existing) return jsonResponse(409, { errors: ['Scenario id already exists'] });
  if (req.method === 'DELETE' && !existing) return jsonResponse(404, { errors: ['Scenario not found'] });

  const result = await mutate(store, 'scenarios', id, req.method === 'DELETE' ? null : scenario, expectedRevision);
  if (result.conflict) return jsonResponse(409, { errors: [result.conflict] });
  if (req.method === 'DELETE') return jsonResponse(200, {
    scenarios: result.catalog.scenarios, series: result.catalog.series, ...contentVersions(result.catalog),
  });
  return jsonResponse(req.method === 'POST' ? 201 : 200, {
    ...scenario, revision: result.revision,
  });
}
