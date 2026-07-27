import { editorStore, readPublishedScenarios, readPublishedSeries } from './editorStore.js';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Public, unauthenticated read endpoint — this is what the deployed game client
// fetches at runtime to get the current puzzle set, instead of the build-time
// import.meta.glob bundle used in local dev. Only serves the published Blobs
// state (see editor-publish.js), never drafts, so in-progress admin edits never
// reach players until explicitly published.
export default async function handler(req) {
  if (req.method !== 'GET') {
    return jsonResponse(405, { errors: ['Method not allowed'] });
  }

  const store = editorStore();
  const [scenarios, series] = await Promise.all([readPublishedScenarios(store), readPublishedSeries(store)]);
  const published = scenarios.filter(scenario => scenario.published !== false);

  return jsonResponse(200, { scenarios: published, series });
}
