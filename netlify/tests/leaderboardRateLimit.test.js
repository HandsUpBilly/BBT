import assert from 'node:assert/strict';
import test from 'node:test';
import { LEADERBOARD_RATE_LIMIT } from '../../shared/rateLimit.js';

/**
 * Covers the 429 wiring on both leaderboard functions, which had no test at
 * all: the limiter itself was unit-tested and the key derivation was
 * hand-copied into each function, so nothing checked that a handler actually
 * buckets by caller or ever refuses.
 *
 * Blobs is never reached — the limiter runs before any store write, and the
 * requests that do get through are answered by the stubbed fetch below.
 */

// getStore() throws unless it can see a site id and token. Neither is used:
// no request in this file gets far enough to touch the network.
process.env.NETLIFY_SITE_ID ??= 'test-site';
process.env.NETLIFY_TOKEN ??= 'test-token';

const realFetch = globalThis.fetch;
globalThis.fetch = async () => new Response('', { status: 404 });
test.after(() => {
  globalThis.fetch = realFetch;
});

// Each module holds its own per-instance limiter, so they are imported
// separately and their buckets do not interfere.
const { default: leaderboard } = await import('../functions/leaderboard.js');
const { default: seriesLeaderboard } = await import('../functions/series-leaderboard.js');

/** A no-roll run: the smallest submission validateScoreSubmission accepts. */
const CLEAN_RUN = { name: 'Coach', probability: 1, diceCount: 0, moves: [] };
const CLEAN_SERIES = {
  name: 'Coach',
  probability: 1,
  diceCount: 0,
  puzzles: [{ scenarioId: 'scn-001', scenarioName: 'One', probability: 1, diceCount: 0, moves: [] }],
};

function post(url, body, ip) {
  return new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Set by the Netlify edge on every real request.
      'x-nf-client-connection-ip': ip,
    },
    body: JSON.stringify(body),
  });
}

async function drainBudget(handler, url, body, ip) {
  for (let i = 0; i < LEADERBOARD_RATE_LIMIT.limit; i += 1) {
    const response = await handler(post(url, body, ip));
    assert.notEqual(response.status, 429, `request ${i + 1} was throttled before the limit`);
  }
}

const SCENARIO_URL = 'https://example.test/api/leaderboard/scn-001';
const SERIES_URL = 'https://example.test/api/series-leaderboard';

test('leaderboard refuses a guest past the limit, with a Retry-After hint', async () => {
  const ip = '203.0.113.1';
  await drainBudget(leaderboard, SCENARIO_URL, CLEAN_RUN, ip);

  const response = await leaderboard(post(SCENARIO_URL, CLEAN_RUN, ip));

  assert.equal(response.status, 429);
  assert.ok(Number(response.headers.get('Retry-After')) > 0);
  assert.match((await response.json()).error, /Too many submissions/);
});

test('leaderboard buckets by caller — a throttled ip does not block anyone else', async () => {
  const ip = '203.0.113.2';
  await drainBudget(leaderboard, SCENARIO_URL, CLEAN_RUN, ip);
  assert.equal((await leaderboard(post(SCENARIO_URL, CLEAN_RUN, ip))).status, 429);

  const neighbour = await leaderboard(post(SCENARIO_URL, CLEAN_RUN, '203.0.113.3'));

  assert.notEqual(neighbour.status, 429);
});

test('leaderboard rejects an invalid payload without spending the caller budget', async () => {
  const ip = '203.0.113.4';

  for (let i = 0; i < LEADERBOARD_RATE_LIMIT.limit * 2; i += 1) {
    const response = await leaderboard(post(SCENARIO_URL, { name: 'Coach', probability: 5 }, ip));
    assert.equal(response.status, 400);
  }

  // The budget is untouched: malformed spam can't lock a caller out.
  assert.notEqual((await leaderboard(post(SCENARIO_URL, CLEAN_RUN, ip))).status, 429);
});

test('series-leaderboard refuses a guest past the limit, with a Retry-After hint', async () => {
  const ip = '203.0.113.5';
  await drainBudget(seriesLeaderboard, SERIES_URL, CLEAN_SERIES, ip);

  const response = await seriesLeaderboard(post(SERIES_URL, CLEAN_SERIES, ip));

  assert.equal(response.status, 429);
  assert.ok(Number(response.headers.get('Retry-After')) > 0);
});

test('series-leaderboard buckets by caller too', async () => {
  const ip = '203.0.113.6';
  await drainBudget(seriesLeaderboard, SERIES_URL, CLEAN_SERIES, ip);
  assert.equal((await seriesLeaderboard(post(SERIES_URL, CLEAN_SERIES, ip))).status, 429);

  assert.notEqual(
    (await seriesLeaderboard(post(SERIES_URL, CLEAN_SERIES, '203.0.113.7'))).status,
    429,
  );
});

test('a rotated x-forwarded-for cannot mint a fresh bucket', async () => {
  const ip = '203.0.113.8';
  await drainBudget(leaderboard, SCENARIO_URL, CLEAN_RUN, ip);

  const request = post(SCENARIO_URL, CLEAN_RUN, ip);
  request.headers.set('x-forwarded-for', '198.51.100.99');

  assert.equal((await leaderboard(request)).status, 429);
});
