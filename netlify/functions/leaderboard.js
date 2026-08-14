import { randomUUID } from 'crypto';
import { AuthError, authErrorResponse, entryAuthFields, verifyOptionalGoogleUser } from './auth.js';
import { leaderboardStore, readEntries, updateEntries } from './blobEntries.js';
import { SCENARIO_ID_RE } from '../../shared/scenarioValidation.js';
import {
  ScoreValidationError,
  sortEntries,
  upsertPersonalBest,
  validateScoreSubmission,
} from '../../shared/scoreValidation.js';
import { LEADERBOARD_RATE_LIMIT, createRateLimiter, rateLimitKey } from '../../shared/rateLimit.js';

// Rows returned to the client. The stored list is NOT trimmed — truncating the
// store used to delete a player's personal best the moment they fell out of the
// visible table, which then broke the by-userId upsert and the home screen's
// "Best / Rank" display.
const TOP_N = 10;

// Per-instance limiter — see shared/rateLimit.js for why that's an acceptable
// trade-off on Netlify Functions.
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
  const url = new URL(req.url);
  // Try query param first (set by netlify.toml redirect), then fall back to last path segment
  const scenarioId =
    url.searchParams.get('scenarioId') ||
    url.pathname.split('/').filter(Boolean).pop() ||
    null;

  // The id becomes a Blobs key, so reject anything that isn't a real scenario
  // id rather than letting arbitrary requests create unbounded blobs.
  if (!scenarioId || !SCENARIO_ID_RE.test(scenarioId)) {
    return json({ error: 'A valid scenarioId is required' }, 400);
  }

  const store = leaderboardStore('leaderboard');

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { entries } = await readEntries(store, scenarioId);
    return json(sortEntries(entries).slice(0, TOP_N), 200, {
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
      score = validateScoreSubmission(body, user);
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
      scenarioId,
      name: score.name,
      probability: score.probability,
      diceCount: score.diceCount,
      date: new Date().toISOString(),
      moves: score.moves,
      ...(score.playLog !== undefined ? { playLog: score.playLog } : {}),
      ...entryAuthFields(user),
    };

    const matches = existing =>
      user ? existing.userId === user.providerUserId : !existing.userId && existing.name === entry.name;

    let persisted;
    try {
      const updated = await updateEntries(store, scenarioId, entries =>
        upsertPersonalBest(entries, entry, matches),
      );
      persisted = updated.find(e => e.id === entry.id) ?? updated.find(matches) ?? entry;
    } catch {
      return json({ error: 'Could not save the score. Please try again.' }, 503);
    }

    // Return whatever is actually on the board — an unbeaten personal best is
    // kept, so the client highlights the surviving row, not a discarded one.
    return json(persisted, 201);
  }

  return json({ error: 'Method not allowed' }, 405);
}
