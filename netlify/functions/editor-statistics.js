import { buildPlayerStatistics } from '../../shared/statistics.js';
import { AdminAuthError, authErrorResponse, requireAdminGoogleUser } from './auth.js';
import { leaderboardStore, readEntries } from './blobEntries.js';
import {
  editorStore,
  readDraftScenarios,
  readDraftSeries,
  toPublicView,
} from './editorStore.js';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(req) {
  try {
    await requireAdminGoogleUser(req);
  } catch (error) {
    if (error instanceof AdminAuthError) return authErrorResponse(error);
    throw error;
  }

  if (req.method !== 'GET') return jsonResponse(405, { errors: ['Method not allowed'] });

  const windowValue = new URL(req.url).searchParams.get('window');
  const windowDays = windowValue === '7' ? 7 : windowValue === '30' ? 30 : undefined;

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
        return [scenario.id, entries];
      }),
    ),
    readEntries(seriesStore, 'series'),
  ]);

  return jsonResponse(200, buildPlayerStatistics({
    scenarios,
    scenarioBoards: Object.fromEntries(boards),
    seriesEntries: seriesResult.entries,
    windowDays,
  }));
}
