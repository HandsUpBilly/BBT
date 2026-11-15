import test from 'node:test';
import assert from 'node:assert/strict';
import { registerIdentityRoutes } from '../../server/identityRoutes.js';
import { createMagicLinkRecord } from '../../shared/identityFlow.js';
import { hashAuthValue, verifyAuthToken } from '../../shared/sessionAuth.js';

const secret = 'magic-link-route-test-secret-at-least-32-chars';

function makeExpressHarness() {
  const routes = new Map();
  const records = new Map();
  const app = {
    get(path, handler) { routes.set('GET ' + path, handler); },
    post(path, handler) { routes.set('POST ' + path, handler); },
  };
  registerIdentityRoutes(app, { magicLinkStore: records });
  const verify = async token => {
    const res = {
      statusCode: 200, body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await routes.get('POST /api/auth/email/verify')({ body: { token } }, res);
    return res;
  };
  return { records, verify };
}

async function addLink(records, token, email = 'tester@example.com') {
  const hash = await hashAuthValue(token);
  records.set(hash, createMagicLinkRecord(email).record);
  return hash;
}

async function withEmailConfig(fn) {
  const keys = ['AUTH_SESSION_SECRET', 'RESEND_API_KEY', 'AUTH_EMAIL_FROM'];
  const before = keys.map(key => process.env[key]);
  process.env.AUTH_SESSION_SECRET = secret;
  process.env.RESEND_API_KEY = 'test-resend-key';
  process.env.AUTH_EMAIL_FROM = 'login@example.com';
  try { await fn(); } finally {
    keys.forEach((key, index) => {
      if (before[index] === undefined) delete process.env[key];
      else process.env[key] = before[index];
    });
  }
}

test('Express verify issues one session, consumes link, and rejects replay', async () => {
  await withEmailConfig(async () => {
    const { records, verify } = makeExpressHarness();
    const token = 'express-single-use-token';
    const hash = await addLink(records, token);
    const first = await verify(token);
    assert.equal(first.statusCode, 200);
    assert.ok(first.body.token);
    const session = await verifyAuthToken(first.body.token, secret);
    assert.equal(session.provider, 'email');
    assert.equal(session.email, 'tester@example.com');
    assert.equal(records.has(hash), false, 'record removed after successful session issue');

    const replay = await verify(token);
    assert.equal(replay.statusCode, 400);
    assert.match(replay.body.error, /invalid or has expired/);
  });
});

test('Express concurrent verifies cannot both issue a session', async () => {
  await withEmailConfig(async () => {
    const { records, verify } = makeExpressHarness();
    const token = 'express-concurrent-token';
    await addLink(records, token);
    const responses = await Promise.all(Array.from({ length: 12 }, () => verify(token)));
    assert.equal(responses.filter(res => res.statusCode === 200).length, 1);
    assert.equal(responses.filter(res => res.statusCode === 400).length, 11);
  });
});

test('Express verify refuses an already consumed, missing, or expired link', async () => {
  await withEmailConfig(async () => {
    const { records, verify } = makeExpressHarness();
    const consumed = 'express-consumed-token';
    const expired = 'express-expired-token';
    const consumedHash = await addLink(records, consumed);
    const expiredHash = await addLink(records, expired);
    records.set(consumedHash, { ...records.get(consumedHash), consumed: true });
    records.set(expiredHash, { ...records.get(expiredHash), expiresAt: Date.now() - 1000 });
    for (const token of [consumed, expired, 'not-issued']) {
      const result = await verify(token);
      assert.equal(result.statusCode, 400);
      assert.equal(result.body.token, undefined);
    }
  });
});
