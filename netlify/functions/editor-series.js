import { normalizeSeries } from './editorValidation.js';
import { editorStore, readDraftScenarios, writeDraftSeries } from './editorStore.js';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(req) {
  if (req.method !== 'PUT') {
    return jsonResponse(405, { errors: ['Method not allowed'] });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { errors: ['Invalid JSON'] });
  }

  const store = editorStore();
  const scenarios = await readDraftScenarios(store);
  const scenarioIds = new Set(scenarios.map(s => s.id));
  const series = normalizeSeries(body);
  const missing = series.scenarioIds.filter(id => !scenarioIds.has(id));
  if (missing.length) {
    return jsonResponse(400, { errors: missing.map(id => `Missing scenario: ${id}`) });
  }

  await writeDraftSeries(store, series);
  return jsonResponse(200, series);
}
