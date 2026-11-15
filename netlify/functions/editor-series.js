import { SCENARIO_ID_RE, normalizeSeries, seriesMembershipErrors, updateSeriesAssignment } from '../../shared/scenarioValidation.js';
import { editorStore, loadContent, readLegacyScenarios, readLegacySeries } from './editorStore.js';
import { writeContentItem, contentVersions, ContentConflictError } from './contentStore.js';
import { AdminAuthError, authErrorResponse, requireAdminGoogleUser } from './auth.js';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
function revisionFromRequest(req) {
  const raw = req.headers.get('If-Match');
  return raw !== null && /^(0|[1-9][0-9]*)$/.test(raw) && Number.isSafeInteger(Number(raw))
    ? Number(raw) : null;
}
const readLegacy = async store => {
  const [scenarios, series] = await Promise.all([readLegacyScenarios(store), readLegacySeries(store)]);
  return { scenarios, series };
};

async function saveItem(store, id, value, revision) {
  try {
    return await writeContentItem(store, () => readLegacy(store),
      { kind: 'series', id, value, expectedRevision: revision });
  } catch (error) {
    if (error instanceof ContentConflictError) return { conflict: error.message };
    throw error;
  }
}

export default async function handler(req) {
  if (!['POST', 'PUT', 'DELETE'].includes(req.method)) return jsonResponse(405, { errors: ['Method not allowed'] });
  try {
    await requireAdminGoogleUser(req);
  } catch (error) {
    if (error instanceof AdminAuthError) return authErrorResponse(error);
    throw error;
  }

  const revision = revisionFromRequest(req);
  if (revision === null) return jsonResponse(428, { errors: ['Reload the editor before changing series membership.'] });

  const url = new URL(req.url);
  const last = url.pathname.split('/').filter(Boolean).at(-1);
  const seriesId = last && !['editor-series', 'series'].includes(last) ? last : null;
  const store = editorStore();
  const catalog = await loadContent(store);
  const existing = catalog.series;

  if (seriesId === 'assignment' && req.method === 'PUT') {
    let request;
    try { request = await req.json(); } catch { return jsonResponse(400, { errors: ['Invalid JSON'] }); }
    const scenarioId = String(request?.scenarioId ?? '');
    const targetSeriesId = String(request?.seriesId ?? '');
    if (!SCENARIO_ID_RE.test(scenarioId) || (targetSeriesId && !SCENARIO_ID_RE.test(targetSeriesId))) {
      return jsonResponse(400, { errors: ['Invalid assignment'] });
    }
    if (!catalog.scenarios.some(item => item.id === scenarioId)) return jsonResponse(404, { errors: ['Scenario not found'] });
    if (targetSeriesId && !existing.some(item => item.id === targetSeriesId)) return jsonResponse(404, { errors: ['Series not found'] });
    const { series: saved, errors } = updateSeriesAssignment(existing, scenarioId, targetSeriesId, catalog.scenarios);
    if (errors.length) return jsonResponse(409, { errors });
    if (saved === existing) return jsonResponse(200, existing);
    // Assignment moves affect two series. Call the multi-series transactional
    // writer, never sequential updates that could leave duplicate membership.
    return jsonResponse(409, { errors: ['Use Series Creator to save membership changes with revision checks.'] });
  }

  if (req.method === 'DELETE') {
    if (!seriesId || !SCENARIO_ID_RE.test(seriesId)) return jsonResponse(400, { errors: ['Invalid series id'] });
    if (!existing.some(item => item.id === seriesId)) return jsonResponse(404, { errors: ['Series not found'] });
    const result = await saveItem(store, seriesId, null, revision);
    if (result.conflict) return jsonResponse(409, { errors: [result.conflict] });
    return jsonResponse(200, { series: result.catalog.series, ...contentVersions(result.catalog) });
  }
  let body;
  try { body = await req.json(); } catch { return jsonResponse(400, { errors: ['Invalid JSON'] }); }
  const item = normalizeSeries({ ...body, id: seriesId ?? body?.id });
  if (!SCENARIO_ID_RE.test(item.id)) return jsonResponse(400, { errors: ['Invalid series id'] });
  if (req.method === 'POST' && existing.some(series => series.id === item.id))
    return jsonResponse(409, { errors: ['Series id already exists'] });

  const known = new Set(catalog.scenarios.map(scenario => scenario.id));
  const missing = item.scenarioIds.filter(id => !known.has(id));
  if (missing.length) return jsonResponse(400, { errors: missing.map(id => `Missing scenario: ${id}`) });
  const errors = seriesMembershipErrors(item, existing, catalog.scenarios);
  if (errors.length) return jsonResponse(409, { errors });
  const result = await saveItem(store, item.id, item, revision);
  if (result.conflict) return jsonResponse(409, { errors: [result.conflict] });
  return jsonResponse(req.method === 'POST' ? 201 : 200, { ...item, revision: result.revision });
}
