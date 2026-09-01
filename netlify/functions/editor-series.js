import { SCENARIO_ID_RE, normalizeSeries, seriesMembershipErrors, updateSeriesAssignment } from '../../shared/scenarioValidation.js';
import { editorStore, readDraftScenarios, readDraftSeries, writeDraftSeries } from './editorStore.js';
import { AdminAuthError, authErrorResponse, requireAdminGoogleUser } from './auth.js';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(req) {
  if (!['POST', 'PUT', 'DELETE'].includes(req.method)) {
    return jsonResponse(405, { errors: ['Method not allowed'] });
  }

  try {
    await requireAdminGoogleUser(req);
  } catch (error) {
    if (error instanceof AdminAuthError) return authErrorResponse(error);
    throw error;
  }

  const url = new URL(req.url);
  const segments = url.pathname.split('/').filter(Boolean);
  const pathId = segments.at(-1);
  const seriesId = pathId && !['editor-series', 'series'].includes(pathId) ? pathId : null;
  const store = editorStore();
  const existing = await readDraftSeries(store);

  if (seriesId === 'assignment' && req.method === 'PUT') {
    let assignment;
    try {
      assignment = await req.json();
    } catch {
      return jsonResponse(400, { errors: ['Invalid JSON'] });
    }
    const scenarioId = String(assignment?.scenarioId ?? '');
    const targetSeriesId = String(assignment?.seriesId ?? '');
    if (!SCENARIO_ID_RE.test(scenarioId) || (targetSeriesId && !SCENARIO_ID_RE.test(targetSeriesId))) {
      return jsonResponse(400, { errors: ['Invalid assignment'] });
    }
    const scenarios = await readDraftScenarios(store);
    if (!scenarios.some(item => item.id === scenarioId)) return jsonResponse(404, { errors: ['Scenario not found'] });
    if (targetSeriesId && !existing.some(item => item.id === targetSeriesId)) return jsonResponse(404, { errors: ['Series not found'] });
    const { series: saved, errors } = updateSeriesAssignment(existing, scenarioId, targetSeriesId, scenarios);
    if (errors.length) return jsonResponse(409, { errors });
    if (saved === existing) return jsonResponse(200, existing);
    await writeDraftSeries(store, saved);
    return jsonResponse(200, saved);
  }

  if (req.method === 'DELETE') {
    if (!seriesId || !SCENARIO_ID_RE.test(seriesId)) return jsonResponse(400, { errors: ['Invalid series id'] });
    if (!existing.some(item => item.id === seriesId)) return jsonResponse(404, { errors: ['Series not found'] });
    const saved = existing.filter(item => item.id !== seriesId);
    await writeDraftSeries(store, saved);
    return jsonResponse(200, saved);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { errors: ['Invalid JSON'] });
  }

  const scenarios = await readDraftScenarios(store);
  const scenarioIds = new Set(scenarios.map(s => s.id));
  const series = normalizeSeries({ ...body, id: seriesId ?? body?.id });
  if (!SCENARIO_ID_RE.test(series.id)) return jsonResponse(400, { errors: ['Invalid series id'] });
  if (req.method === 'POST' && existing.some(item => item.id === series.id)) {
    return jsonResponse(409, { errors: ['Series id already exists'] });
  }
  const missing = series.scenarioIds.filter(id => !scenarioIds.has(id));
  if (missing.length) {
    return jsonResponse(400, { errors: missing.map(id => `Missing scenario: ${id}`) });
  }
  const membershipErrors = seriesMembershipErrors(series, existing, scenarios);
  if (membershipErrors.length) return jsonResponse(409, { errors: membershipErrors });

  const saved = existing.some(item => item.id === series.id)
    ? existing.map(item => item.id === series.id ? series : item)
    : [...existing, series];
  await writeDraftSeries(store, saved);
  return jsonResponse(req.method === 'POST' ? 201 : 200, series);
}
