import { AdminAuthError, authErrorResponse, requireAdminGoogleUser } from './auth.js';
import { leaderboardStore, readEntries } from './blobEntries.js';
import { sortLogins } from '../../shared/loginTracking.js';

const KEY = 'logins';

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

  const store = leaderboardStore('player-logins');
  const { entries } = await readEntries(store, KEY);
  return jsonResponse(200, sortLogins(entries));
}
