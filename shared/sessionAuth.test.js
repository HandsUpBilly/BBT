import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SessionAuthError,
  normalizeAuthEmail,
  providerUserId,
  signAuthToken,
  verifyAuthToken,
} from './sessionAuth.js';

const secret = 'test-secret-that-is-at-least-thirty-two-characters';

test('Turn 16 sessions round-trip and reject tampering or expiry', async () => {
  const now = Date.UTC(2026, 8, 2);
  const token = await signAuthToken({ sub: 'discord:123', provider: 'discord', purpose: 'session', email: 'coach@example.com' }, secret, {
    now,
    lifetimeSeconds: 60,
  });
  assert.equal((await verifyAuthToken(token, secret, { now: now + 30_000 })).sub, 'discord:123');
  await assert.rejects(() => verifyAuthToken(`${token.slice(0, -1)}x`, secret, { now }), SessionAuthError);
  await assert.rejects(() => verifyAuthToken(token, secret, { now: now + 61_000 }), /expired/);
});

test('email normalization and provider ids are stable without exposing addresses', async () => {
  assert.equal(normalizeAuthEmail(' Coach@Example.COM '), 'coach@example.com');
  assert.throws(() => normalizeAuthEmail('not-an-email'), /valid email/);
  const first = await providerUserId('email', 'coach@example.com');
  assert.equal(first, await providerUserId('email', 'coach@example.com'));
  assert.equal(first.includes('coach'), false);
  assert.equal(await providerUserId('google', 'legacy-google-sub'), 'legacy-google-sub');
});
