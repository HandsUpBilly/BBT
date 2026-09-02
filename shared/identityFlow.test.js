import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authConfiguration,
  createMagicLinkRecord,
  issueIdentitySession,
  validateMagicLinkRecord,
} from './identityFlow.js';
import { sessionUserFromPayload, verifyAuthToken } from './sessionAuth.js';

const secret = 'test-secret-that-is-at-least-thirty-two-characters';

test('provider configuration exposes only complete server-side flows', () => {
  assert.deepEqual(authConfiguration({ GOOGLE_CLIENT_ID: 'google' }), { google: true, discord: false, email: false });
  assert.deepEqual(authConfiguration({
    AUTH_SESSION_SECRET: secret,
    DISCORD_CLIENT_ID: 'client',
    DISCORD_CLIENT_SECRET: 'secret',
    DISCORD_REDIRECT_URI: 'https://example.com/api/auth/discord/callback',
    RESEND_API_KEY: 'resend',
    AUTH_EMAIL_FROM: 'Turn 16 <login@example.com>',
  }), { google: false, discord: true, email: true });
});

test('issued sessions carry a private stable provider id and verified email', async () => {
  const session = await issueIdentitySession({
    provider: 'email', subject: 'coach@example.com', email: 'Coach@Example.com',
  }, secret);
  const payload = await verifyAuthToken(session.token, secret);
  const user = sessionUserFromPayload(payload);
  assert.equal(user.provider, 'email');
  assert.equal(user.email, 'coach@example.com');
  assert.match(user.providerUserId, /^email-[A-Za-z0-9_-]{32}$/);
  assert.equal(user.providerUserId.includes('coach'), false);
});

test('magic links expire and cannot validate after being consumed', () => {
  const now = Date.UTC(2026, 8, 2);
  const { record } = createMagicLinkRecord('coach@example.com', now);
  assert.equal(validateMagicLinkRecord(record, now + 1), 'coach@example.com');
  assert.throws(() => validateMagicLinkRecord({ ...record, consumed: true }, now + 1), /invalid or has expired/);
  assert.throws(() => validateMagicLinkRecord(record, record.expiresAt + 1), /invalid or has expired/);
});
