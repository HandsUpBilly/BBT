import { AuthError, authErrorResponse, verifyOptionalGoogleUser } from './auth.js';
import { leaderboardStore, updateEntries } from './blobEntries.js';
import { LoginValidationError, recordLogin, validateLoginPayload } from '../../shared/loginTracking.js';
import { LOGIN_RATE_LIMIT, createRateLimiter, rateLimitKey } from '../../shared/rateLimit.js';

// See leaderboard.js — single blob, all entries kept (never truncated).
const KEY = 'logins';

// Per-instance limiter — see shared/rateLimit.js and leaderboard.js.
const takeLoginToken = createRateLimiter(LOGIN_RATE_LIMIT);

const clientKey = (req, user) =>
  rateLimitKey({ user, getHeader: name => req.headers.get(name) });

function json(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let user = null;
  try {
    user = await verifyOptionalGoogleUser(req);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  let login;
  try {
    login = validateLoginPayload(body);
  } catch (error) {
    if (error instanceof LoginValidationError) return json({ error: error.message }, 400);
    throw error;
  }

  // Rate-limit after validation so malformed spam can't burn a caller's budget.
  const { allowed, retryAfterSeconds } = takeLoginToken(clientKey(req, user));
  if (!allowed) {
    return json(
      { error: 'Too many login attempts. Please wait a moment.' },
      429,
      { 'Retry-After': String(retryAfterSeconds) },
    );
  }

  const store = leaderboardStore('player-logins');
  let entry;
  try {
    await updateEntries(store, KEY, entries => {
      const result = recordLogin(entries, { name: login.name, user });
      entry = result.entry;
      return result.entries;
    });
  } catch {
    return json({ error: 'Could not record the login' }, 502);
  }

  return json(entry, 201);
}
