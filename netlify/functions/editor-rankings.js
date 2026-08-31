import {
  RankingResetValidationError,
  parseRankingResetTarget,
} from '../../shared/rankingReset.js';
import { AdminAuthError, authErrorResponse, requireAdminGoogleUser } from './auth.js';
import { leaderboardStore } from './blobEntries.js';
import {
  editorStore,
  readPublishedScenarios,
  readPublishedSeries,
  toPublicView,
} from './editorStore.js';
import { clearRankingTarget, readRankingResetSummary } from './rankingResetStore.js';

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  });
}

async function context() {
  const drafts = editorStore();
  const [publishedScenarios, publishedSeries] = await Promise.all([
    readPublishedScenarios(drafts),
    readPublishedSeries(drafts),
  ]);
  const { scenarios, series } = toPublicView(publishedScenarios, publishedSeries);
  return {
    scenarioStore: leaderboardStore('leaderboard'),
    seriesStore: leaderboardStore('series-leaderboard'),
    scenarios,
    series,
  };
}

export default async function handler(req) {
  try { await requireAdminGoogleUser(req); }
  catch (error) {
    if (error instanceof AdminAuthError) return authErrorResponse(error);
    throw error;
  }

  const stores = await context();
  if (req.method === 'GET') return json(200, await readRankingResetSummary(stores));
  if (req.method !== 'DELETE') return json(405, { error: 'Method not allowed' });

  const url = new URL(req.url);
  try {
    const target = parseRankingResetTarget(url.searchParams.get('scope'), url.searchParams.get('id'));
    const result = await clearRankingTarget({ ...stores, target });
    if (!result) return json(404, { error: 'Ranking board not found' });
    return json(200, {
      ...result,
      summary: await readRankingResetSummary(stores),
    });
  } catch (error) {
    if (error instanceof RankingResetValidationError) return json(400, { error: error.message });
    throw error;
  }
}
