import { normalizeScenario, validateScenario, SCENARIO_ID_RE } from './editorValidation.js';
import { editorStore, readDraftScenarios, writeDraftScenarios, readDraftSeries } from './editorStore.js';

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

export default async function handler(req) {
  const url = new URL(req.url);
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
    const id = scenarioIdFromPath(url.pathname) ?? url.searchParams.get('scenarioId');
    if (!id || !SCENARIO_ID_RE.test(id)) return jsonResponse(400, { errors: ['Invalid scenario id'] });

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

  return jsonResponse(405, { errors: ['Method not allowed'] });
}
