import assert from 'node:assert/strict';
import test from 'node:test';
import { AdminAuthError, bearerToken, createGoogleAuth, entryAuthFields, parseAdminEmails } from './googleAuth.js';

const headers = map => name => map[name.toLowerCase()] ?? null;

test('bearerToken accepts only a well-formed Bearer header', () => {
  assert.equal(bearerToken(headers({ authorization: 'Bearer abc123' })), 'abc123');
  assert.equal(bearerToken(headers({ authorization: 'bearer abc123' })), 'abc123');
  assert.equal(bearerToken(headers({ authorization: 'Basic abc123' })), null);
  assert.equal(bearerToken(headers({ authorization: 'Bearer' })), null);
  assert.equal(bearerToken(headers({})), null);
});

test('parseAdminEmails normalizes case and whitespace', () => {
  assert.deepEqual(
    [...parseAdminEmails(' A@x.com , b@Y.com ,, ')],
    ['a@x.com', 'b@y.com'],
  );
  assert.equal(parseAdminEmails(undefined).size, 0);
});

test('production fails CLOSED when no allowlist is configured', async () => {
  // The old behavior returned null here, which meant a forgotten ADMIN_EMAILS
  // env var silently opened the editor to anyone on the internet.
  const auth = createGoogleAuth({ clientId: 'x', adminEmails: '', allowUnauthenticated: false });
  await assert.rejects(
    () => auth.requireAdminGoogleUser(headers({})),
    error => error instanceof AdminAuthError && error.status === 503,
  );
});

test('local dev may explicitly opt into the unauthenticated editor', async () => {
  const auth = createGoogleAuth({ clientId: 'x', adminEmails: '', allowUnauthenticated: true });
  assert.equal(await auth.requireAdminGoogleUser(headers({})), null);
});

test('a configured allowlist requires sign-in, then membership', async () => {
  const auth = createGoogleAuth({
    clientId: 'x', adminEmails: 'admin@x.com', allowUnauthenticated: true,
  });
  await assert.rejects(
    () => auth.requireAdminGoogleUser(headers({})),
    error => error instanceof AdminAuthError && error.status === 401,
  );
  assert.equal(auth.isAdminUser({ email: 'ADMIN@x.com' }), true);
  assert.equal(auth.isAdminUser({ email: 'someone@x.com' }), false);
  // An unverified Google email arrives as undefined and can never match.
  assert.equal(auth.isAdminUser({ email: undefined }), false);
  assert.equal(auth.isAdminUser(null), false);
});

test('entryAuthFields copies only the display metadata, never the email', () => {
  assert.deepEqual(entryAuthFields(null), {});
  assert.deepEqual(
    entryAuthFields({
      provider: 'google', providerUserId: 'sub-1', name: 'Coach',
      email: 'secret@x.com', picture: 'https://img',
    }),
    { userId: 'sub-1', authProvider: 'google', displayName: 'Coach', avatarUrl: 'https://img' },
  );
});
