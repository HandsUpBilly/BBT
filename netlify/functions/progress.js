import { editorStore, readPublishedScenarios, readPublishedSeries, toPublicView } from './editorStore.js';
import { leaderboardStore, readEntries } from './blobEntries.js';
import { sortEntries } from '../../shared/scoreValidation.js';

// Combined home-screen progress in one request.
//
// ScenarioSelect used to fire one leaderboard request per scenario plus the
// series board — and twice per visit, because the scenario array identity
// changes when the runtime fetch resolves. That was 12 function invocations for
// five puzzles. This collapses it to one.
const TOP_N = 10;

export default async function handler(req) {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ errors: ['Method not allowed'] }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const drafts = editorStore();
  const [publishedScenarios, publishedSeries] = await Promise.all([
    readPublishedScenarios(drafts),
    readPublishedSeries(drafts),
  ]);
  const { scenarios } = toPublicView(publishedScenarios, publishedSeries);

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
