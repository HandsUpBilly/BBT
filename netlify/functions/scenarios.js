import { editorStore, readDraftScenarios, readDraftSeries, toPublicView } from './editorStore.js';

// Public, unauthenticated read endpoint — this is what the deployed game client
// fetches at runtime to get the current puzzle set, instead of the build-time
// import.meta.glob bundle used in local dev. Saved editor data is the live
// source of truth; the per-puzzle and per-series enabled flags decide what is
// visible to players.
export default async function handler(req) {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ errors: ['Method not allowed'] }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const store = editorStore();
  const [scenarios, series] = await Promise.all([
    readDraftScenarios(store),
    readDraftSeries(store),
  ]);

  return new Response(JSON.stringify(toPublicView(scenarios, series)), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      // Admin saves should be visible when the app returns to the home screen.
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}
