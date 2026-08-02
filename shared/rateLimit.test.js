import assert from 'node:assert/strict';
import test from 'node:test';
import { createRateLimiter } from './rateLimit.js';

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
