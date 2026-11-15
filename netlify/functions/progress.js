import { editorStore, readDraftScenarios, readDraftSeries, toPublicView } from './editorStore.js';
import { leaderboardStore, readEntries } from './blobEntries.js';
import { sortEntries } from '../../shared/scoreValidation.js';
import { PROGRESS_RATE_LIMIT, createRateLimiter, rateLimitKey } from '../../shared/rateLimit.js';

// Combined home-screen progress in one request.
//
// ScenarioSelect used to fire one leaderboard request per scenario plus the
// series board — and twice per visit, because the scenario array identity
// changes when the runtime fetch resolves. That was 12 function invocations for
// five puzzles. This collapses it to one.
const TOP_N = 10;
const takeProgressToken = createRateLimiter(PROGRESS_RATE_LIMIT);

// Export the guard separately so the 429 response and trusted-IP bucketing can
// be tested without contacting Netlify Blobs.
export function progressRateLimitResponse(req, take = takeProgressToken) {
  const key = rateLimitKey({ getHeader: name => req.headers.get(name) });
  const { allowed, retryAfterSeconds } = take(key);
  if (allowed) return null;
  return new Response(JSON.stringify({ error: 'Too many progress requests. Please try again shortly.' }), {
    status: 429,
    headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfterSeconds), 'Cache-Control': 'no-store' },
  });
}


export default async function handler(req) {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ errors: ['Method not allowed'] }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check before any of the per-scenario Blobs reads; cache-busting query
  // parameters must not create new rate-limit buckets.
  const throttled = progressRateLimitResponse(req);
  if (throttled) return throttled;

  const drafts = editorStore();
  const [savedScenarios, savedSeries] = await Promise.all([
    readDraftScenarios(drafts),
    readDraftSeries(drafts),
  ]);
  const { scenarios } = toPublicView(savedScenarios, savedSeries);

  const scenarioStore = leaderboardStore('leaderboard');
  const seriesStore = leaderboardStore('series-leaderboard');

  const [boards, seriesResult] = await Promise.all([
    Promise.all(
      scenarios.map(async scenario => {
        const { entries } = await readEntries(scenarioStore, scenario.id);
        return [scenario.id, sortEntries(entries).slice(0, TOP_N)];
      }),
    ),
    readEntries(seriesStore, 'series'),
  ]);

  return new Response(
    JSON.stringify({
      scenarios: Object.fromEntries(boards),
      series: sortEntries(seriesResult.entries).slice(0, TOP_N),
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=15',
      },
    },
  );
}
