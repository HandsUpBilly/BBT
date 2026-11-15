import test from 'node:test';
import assert from 'node:assert/strict';
import { createIdentityHandler } from '../functions/identity-auth.js';
import { createMagicLinkRecord } from '../../shared/identityFlow.js';
import { hashAuthValue, verifyAuthToken } from '../../shared/sessionAuth.js';

const secret = 'netlify-magic-link-route-test-secret-32-characters';

function fakeStore({ missingEtag = false, rejectCAS = false, throwCAS = false } = {}) {
  const records = new Map();
  const writes = [];
  let version = 0;
  const store = {
    async getWithMetadata(key, options) {
      assert.deepEqual(options, { type: 'text' });
      const row = records.get(key);
      return row ? { data: row.data, ...(missingEtag ? {} : { etag: row.etag }) } : null;
    },
    async set(key, data, options) {
      writes.push({ key, data: JSON.parse(data), options });
      if (throwCAS) throw new Error('CAS backend unavailable');
      const row = records.get(key);
      if (rejectCAS || !row || options?.onlyIfMatch !== row.etag) return { modified: false };
      records.set(key, { data, etag: String(++version) });
      return { modified: true };
    },
    async delete(key) { records.delete(key); },
  };
  const add = async (token, record = createMagicLinkRecord('tester@example.com').record) => {
    const key = await hashAuthValue(token);
    records.set(key, { data: JSON.stringify(record), etag: String(++version) });
    return key;
  };
  return { store, records, writes, add };
}

function verifyHandler(store) {
  const handler = createIdentityHandler(() => store);
  return async token => {
    const request = new Request('https://turn-16.example/api/auth/email/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const response = await handler(request);
    return { status: response.status, body: await response.json() };
  };
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

test('Netlify verify consumes via etag CAS before issuing a session; replay fails', async () => {
  await withEmailConfig(async () => {
    const db = fakeStore();
    const token = 'netlify-one-use-token';
    const key = await db.add(token);
    const verify = verifyHandler(db.store);
    const result = await verify(token);
    assert.equal(result.status, 200);
    const session = await verifyAuthToken(result.body.token, secret);
    assert.equal(session.provider, 'email');
    assert.equal(session.email, 'tester@example.com');
    assert.equal(db.records.has(key), false, 'consumed record deleted only after session');
    assert.equal(db.writes.length, 1);
    assert.deepEqual(Object.keys(db.writes[0].options), ['onlyIfMatch']);
    assert.equal(db.writes[0].data.consumed, true);
    assert.equal(db.writes[0].options.onlyIfMatch, '1');

    const replay = await verify(token);
    assert.equal(replay.status, 400);
    assert.equal(replay.body.token, undefined);
  });
});

test('Netlify concurrent reads of the same link yield exactly one successful CAS', async () => {
  await withEmailConfig(async () => {
    const db = fakeStore();
    const token = 'netlify-concurrent-token';
    await db.add(token);
    const responses = await Promise.all(Array.from({ length: 12 }, () => verifyHandler(db.store)(token)));
    assert.equal(responses.filter(res => res.status === 200).length, 1);
    assert.equal(responses.filter(res => res.status === 400).length, 11);
    assert.equal(db.writes.filter(write => write.data.consumed === true).length >= 1, true);
  });
});

test('Netlify refuses a missing etag without issuing a session or writing a fallback', async () => {
  await withEmailConfig(async () => {
    const db = fakeStore({ missingEtag: true });
    await db.add('netlify-etagless-token');
    const result = await verifyHandler(db.store)('netlify-etagless-token');
    assert.equal(result.status, 400);
    assert.equal(db.writes.length, 0, 'never fall back to onlyIfNew on an existing record');
  });
});

test('Netlify rejects CAS conflicts and exceptions rather than issuing a session', async () => {
  await withEmailConfig(async () => {
    for (const options of [{ rejectCAS: true }, { throwCAS: true }]) {
      const db = fakeStore(options);
      await db.add('netlify-cas-conflict-token');
      const result = await verifyHandler(db.store)('netlify-cas-conflict-token');
      assert.equal(result.status, 400);
      assert.equal(result.body.token, undefined);
    }
  });
});

test('Netlify refuses consumed, expired and nonexistent links before CAS', async () => {
  await withEmailConfig(async () => {
    const db = fakeStore();
    await db.add('netlify-used-token', { ...createMagicLinkRecord('tester@example.com').record, consumed: true });
    await db.add('netlify-expired-token', { ...createMagicLinkRecord('tester@example.com').record, expiresAt: Date.now() - 1000 });
    const verify = verifyHandler(db.store);
    for (const token of ['netlify-used-token', 'netlify-expired-token', 'never-issued']) {
      const result = await verify(token);
      assert.equal(result.status, 400);
    }
    assert.equal(db.writes.length, 0);
  });
});
