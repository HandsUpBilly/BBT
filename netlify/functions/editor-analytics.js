import { buildEngagementAnalytics } from '../../shared/analyticsStatistics.js';
import { AdminAuthError, authErrorResponse, requireAdminGoogleUser } from './auth.js';
import { analyticsSessionStore, listAnalyticsSessions } from './analyticsStore.js';

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
export default async function handler(req) {
  try {
    await requireAdminGoogleUser(req);
  } catch (error) {
    if (error instanceof AdminAuthError) return authErrorResponse(error);
    throw error;
  }
  if (req.method !== 'GET') return json(405, { error: 'Method not allowed' });
  const value = Number(new URL(req.url).searchParams.get('window'));
  const windowDays = [7, 30, 90, 365].includes(value) ? value : 30;
  try {
    const records = await listAnalyticsSessions(analyticsSessionStore());
    return json(200, buildEngagementAnalytics({ sessions: records.map(record => record.session), windowDays }));
  } catch {
    return json(503, { error: 'Could not load engagement analytics' });
  }
}
