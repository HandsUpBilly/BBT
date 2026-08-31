import {
  PlayerProfileValidationError,
  toPublicPlayerProfile,
  updatePlayerProfile,
} from '../../shared/playerProfile.js';
import { PROFILE_RATE_LIMIT, createRateLimiter, rateLimitKey } from '../../shared/rateLimit.js';
import { AdminAuthError, authErrorResponse, requireVerifiedGoogleUser } from './auth.js';
import { readPlayerProfile, writePlayerProfile } from './profileStore.js';

const takeProfileToken = createRateLimiter(PROFILE_RATE_LIMIT);

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export default async function handler(req) {
  let user;
  try { user = await requireVerifiedGoogleUser(req); }
  catch (error) {
    if (error instanceof AdminAuthError) return authErrorResponse(error);
    throw error;
  }

  if (req.method === 'GET') {
    const profile = await readPlayerProfile(user.providerUserId);
    return json(toPublicPlayerProfile(profile) ?? { userId: user.providerUserId }, 200, {
      'Cache-Control': 'private, no-store',
      Vary: 'Authorization',
    });
  }

  if (req.method === 'PUT') {
    const limit = takeProfileToken(rateLimitKey({
      user,
      getHeader: name => req.headers.get(name),
    }));
    if (!limit.allowed) {
      return json({ error: 'Too many profile changes. Please wait and try again.' }, 429, {
        'Retry-After': String(limit.retryAfterSeconds),
      });
    }

    let body;
    try { body = await req.json(); }
    catch { return json({ error: 'Invalid JSON' }, 400); }

    try {
      const next = updatePlayerProfile(await readPlayerProfile(user.providerUserId), user, body);
      await writePlayerProfile(next);
      return json(toPublicPlayerProfile(next), 200, {
        'Cache-Control': 'private, no-store',
        Vary: 'Authorization',
      });
    } catch (error) {
      if (error instanceof PlayerProfileValidationError) return json({ error: error.message }, 400);
      throw error;
    }
  }

  return json({ error: 'Method not allowed' }, 405);
}
