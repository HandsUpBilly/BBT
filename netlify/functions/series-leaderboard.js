import { randomUUID } from 'crypto';
import { AuthError, authErrorResponse, entryAuthFields, verifyOptionalGoogleUser } from './auth.js';
import { leaderboardStore, readEntries, updateEntries } from './blobEntries.js';
import {
  ScoreValidationError,
  sortEntries,
  upsertPersonalBest,
  validateSeriesSubmission,
} from '../../shared/scoreValidation.js';
import { LEADERBOARD_RATE_LIMIT, createRateLimiter, rateLimitKey } from '../../shared/rateLimit.js';
import { enrichEntriesWithProfiles } from './profileStore.js';

// See leaderboard.js — read-truncated only, the store keeps every entry.
const TOP_N = 10;
const KEY = 'series';

// Per-instance limiter — see shared/rateLimit.js and leaderboard.js.
const takeLeaderboardToken = createRateLimiter(LEADERBOARD_RATE_LIMIT);

const clientKey = (req, user) =>
  rateLimitKey({ user, getHeader: name => req.headers.get(name) });

function json(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export default async function handler(req) {
  const store = leaderboardStore('series-leaderboard');

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { entries } = await readEntries(store, KEY);
    const visible = sortEntries(entries).slice(0, TOP_N);
    return json(await enrichEntriesWithProfiles(visible), 200, {
      'Cache-Control': 'public, max-age=15',
    });
  }

  // ── POST ─────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
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

    let score;
    try {
      score = validateSeriesSubmission(body, user);
    } catch (error) {
      if (error instanceof ScoreValidationError) return json({ error: error.message }, 400);
      throw error;
    }

    // Rate-limit after validation so malformed spam can't burn a caller's budget.
    const { allowed, retryAfterSeconds } = takeLeaderboardToken(clientKey(req, user));
    if (!allowed) {
      return json(
        { error: 'Too many submissions. Please wait a moment and try again.' },
        429,
        { 'Retry-After': String(retryAfterSeconds) },
      );
    }

    const entry = {
      id: randomUUID(),
      name: score.name,
      probability: score.probability,
      diceCount: score.diceCount,
      date: new Date().toISOString(),
      puzzles: score.puzzles,
      ...entryAuthFields(user),
    };

    const matches = existing =>
      user ? existing.userId === user.providerUserId : !existing.userId && existing.name === entry.name;

    let persisted;
    try {
      const updated = await updateEntries(store, KEY, entries =>
        upsertPersonalBest(entries, entry, matches),
      );
      persisted = updated.find(e => e.id === entry.id) ?? updated.find(matches) ?? entry;
    } catch {
      return json({ error: 'Could not save the series score. Please try again.' }, 503);
    }

    return json(persisted, 201);
  }

  return json({ error: 'Method not allowed' }, 405);
}
