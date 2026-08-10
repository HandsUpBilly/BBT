import assert from 'node:assert/strict';
import test from 'node:test';
import { createRateLimiter, rateLimitKey } from './rateLimit.js';

test('allows up to the limit, then refuses with a retry hint', () => {
  let now = 0;
  const take = createRateLimiter({ limit: 3, windowMs: 1000, now: () => now });

  assert.equal(take('a').allowed, true);
  assert.equal(take('a').allowed, true);
  assert.equal(take('a').remaining, 0);

  const blocked = take('a');
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 1);
});

test('buckets are independent per key', () => {
  let now = 0;
  const take = createRateLimiter({ limit: 1, windowMs: 1000, now: () => now });

  assert.equal(take('a').allowed, true);
  assert.equal(take('a').allowed, false);
  // A different reporter is unaffected.
  assert.equal(take('b').allowed, true);
});

test('the window resets once it elapses', () => {
  let now = 0;
  const take = createRateLimiter({ limit: 1, windowMs: 1000, now: () => now });

  assert.equal(take('a').allowed, true);
  assert.equal(take('a').allowed, false);
  now = 1000;
  assert.equal(take('a').allowed, true);
});

// ── rateLimitKey ────────────────────────────────────────────────────────────
// Both deployment targets share this, so a change here changes the throttling
// bucket everywhere at once — which is the point of consolidating it.

const headers = map => name => map[name] ?? null;

test('a verified user is keyed by identity, not by address', () => {
  const key = rateLimitKey({
    user: { providerUserId: 'google-123' },
    getHeader: headers({ 'x-nf-client-connection-ip': '203.0.113.9' }),
  });

  assert.equal(key, 'user:google-123');
});

test('one signed-in player shares a bucket across addresses', () => {
  const user = { providerUserId: 'google-123' };
  assert.equal(
    rateLimitKey({ user, getHeader: headers({ 'x-nf-client-connection-ip': '198.51.100.1' }) }),
    rateLimitKey({ user, getHeader: headers({ 'x-nf-client-connection-ip': '203.0.113.9' }) }),
  );
});

test('a guest on Netlify is keyed by the edge-set connection ip', () => {
  const key = rateLimitKey({
    user: null,
    getHeader: headers({ 'x-nf-client-connection-ip': '203.0.113.9' }),
  });

  assert.equal(key, 'ip:203.0.113.9');
});

test('a guest on Express is keyed by req.ip, which has no header equivalent', () => {
  assert.equal(rateLimitKey({ user: null, remoteAddress: '203.0.113.9' }), 'ip:203.0.113.9');
});

test('x-forwarded-for is ignored — a spoofable key would make the limiter a no-op', () => {
  const first = rateLimitKey({ user: null, getHeader: headers({ 'x-forwarded-for': '1.1.1.1' }) });
  const second = rateLimitKey({ user: null, getHeader: headers({ 'x-forwarded-for': '2.2.2.2' }) });

  // An attacker rotating the header must NOT mint a fresh bucket each request.
  assert.equal(first, 'unknown');
  assert.equal(second, 'unknown');
});

test('the edge-set ip wins over a trusted remote address when both are present', () => {
  const key = rateLimitKey({
    user: null,
    getHeader: headers({ 'x-nf-client-connection-ip': '203.0.113.9' }),
    remoteAddress: '10.0.0.1',
  });

  assert.equal(key, 'ip:203.0.113.9');
});

test('blank and missing values fall through to the shared unknown bucket', () => {
  assert.equal(rateLimitKey({ user: null, getHeader: headers({ 'x-nf-client-connection-ip': '   ' }) }), 'unknown');
  assert.equal(rateLimitKey({ user: null, remoteAddress: '' }), 'unknown');
  assert.equal(rateLimitKey({}), 'unknown');
  assert.equal(rateLimitKey(), 'unknown');
});

test('a user without a providerUserId is treated as a guest', () => {
  assert.equal(rateLimitKey({ user: {}, remoteAddress: '203.0.113.9' }), 'ip:203.0.113.9');
});
