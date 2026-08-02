import { editorStore, readPublishedScenarios, readPublishedSeries, toPublicView } from './editorStore.js';

// Public, unauthenticated read endpoint — this is what the deployed game client
// fetches at runtime to get the current puzzle set, instead of the build-time
// import.meta.glob bundle used in local dev. Only serves the published Blobs
// state (see editor-publish.js), never drafts, so in-progress admin edits never
// reach players until explicitly published.
export default async function handler(req) {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ errors: ['Method not allowed'] }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const store = editorStore();
  const [scenarios, series] = await Promise.all([
    readPublishedScenarios(store),
    readPublishedSeries(store),
  ]);

  return new Response(JSON.stringify(toPublicView(scenarios, series)), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      // Every page load hits this. A short cache keeps a publish visible within
      // a minute while removing a Blobs read from the critical path.
      'Cache-Control': 'public, max-age=60',
    },
  });
}
