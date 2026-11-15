import assert from 'node:assert/strict';
import test from 'node:test';
import { createRateLimiter, PROGRESS_RATE_LIMIT } from '../../shared/rateLimit.js';

const { default: handler, progressRateLimitResponse } = await import('../functions/progress.js');

const request = (ip, suffix = '') => new Request(`https://example.test/api/progress${suffix}`, {
  headers: { 'x-nf-client-connection-ip': ip },
});

test('progress read budget is generous enough for regular navigation', () => {
  assert.equal(PROGRESS_RATE_LIMIT.limit, 60);
  assert.equal(PROGRESS_RATE_LIMIT.windowMs, 60_000);
});

test('progress guard throttles before Blobs access and emits Retry-After', async () => {
  const take = createRateLimiter({ limit: 2, windowMs: 60_000, now: () => 0 });
  assert.equal(progressRateLimitResponse(request('203.0.113.1'), take), null);
  assert.equal(progressRateLimitResponse(request('203.0.113.1', '?cachebuster=a'), take), null);
  const blocked = progressRateLimitResponse(request('203.0.113.1', '?cachebuster=b'), take);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('Retry-After'), '60');
  assert.equal(blocked.headers.get('Cache-Control'), 'no-store');
  assert.match((await blocked.json()).error, /Too many progress requests/);
});

test('progress guard buckets by trusted edge IP, not user-controlled query or forwarded-for', () => {
  const take = createRateLimiter({ limit: 1, windowMs: 60_000, now: () => 0 });
  const first = request('203.0.113.2');
  first.headers.set('x-forwarded-for', '198.51.100.10');
  assert.equal(progressRateLimitResponse(first, take), null);
  const rotated = request('203.0.113.2', '?random=1');
  rotated.headers.set('x-forwarded-for', '198.51.100.11');
  assert.equal(progressRateLimitResponse(rotated, take).status, 429);
  assert.equal(progressRateLimitResponse(request('203.0.113.3'), take), null);
});

test('unsupported methods return 405 without spending read quota or accessing Blobs', async () => {
  const response = await handler(new Request('https://example.test/api/progress', { method: 'POST' }));
  assert.equal(response.status, 405);
});
