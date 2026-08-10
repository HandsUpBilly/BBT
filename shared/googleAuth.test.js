import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AdminAuthError,
  AuthError,
  bearerToken,
  createGoogleAuth,
  entryAuthFields,
  makeGoogleTokenVerifier,
  parseAdminEmails,
} from './googleAuth.js';

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

test('an explicit strict configuration fails closed when no allowlist is configured', async () => {
  const auth = createGoogleAuth({ verifyIdToken: null, adminEmails: '', allowUnauthenticated: false });
  await assert.rejects(
    () => auth.requireAdminGoogleUser(headers({})),
    error => error instanceof AdminAuthError && error.status === 503,
  );
});

test('no allowlist defaults to unrestricted admin access', async () => {
  const auth = createGoogleAuth({ verifyIdToken: null, adminEmails: '' });
  assert.equal(await auth.requireAdminGoogleUser(headers({})), null);
});

/**
 * The cold-start warning is the only signal that a deployment is fail-open —
 * there is no banner and no health check. A cleared or typo'd ADMIN_EMAILS
 * would otherwise open every /api/editor/* route silently and indefinitely,
 * so the log line is load-bearing rather than cosmetic.
 */
function captureWarnings(run) {
  const warnings = [];
  const original = console.warn;
  console.warn = message => warnings.push(String(message));
  try {
    run();
  } finally {
    console.warn = original;
  }
  return warnings;
}

test('an empty allowlist that stays open warns at cold start', () => {
  const warnings = captureWarnings(() =>
    createGoogleAuth({ verifyIdToken: null, adminEmails: '' }),
  );

  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /ADMIN_EMAILS is empty/);
  assert.match(warnings[0], /EDITOR_ALLOW_UNAUTHENTICATED=false/);
});

test('a configured allowlist, or an explicit fail-closed, stays quiet', () => {
  assert.deepEqual(
    captureWarnings(() => createGoogleAuth({ verifyIdToken: null, adminEmails: 'admin@x.com' })),
    [],
  );
  assert.deepEqual(
    captureWarnings(() =>
      createGoogleAuth({ verifyIdToken: null, adminEmails: '', allowUnauthenticated: false }),
    ),
    [],
  );
});

test('a configured allowlist requires sign-in, then membership', async () => {
  const auth = createGoogleAuth({
    verifyIdToken: null, adminEmails: 'admin@x.com', allowUnauthenticated: true,
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

test('makeGoogleTokenVerifier checks the audience and returns the payload', async () => {
  // The OAuth2Client class is injected rather than imported so shared/ stays
  // dependency-free — importing google-auth-library here broke the Netlify
  // functions bundle, because shared/ is not an ancestor of its node_modules.
  const calls = [];
  class FakeOAuth2Client {
    constructor(clientId) { this.clientId = clientId; }
    async verifyIdToken(options) {
      calls.push(options);
      return { getPayload: () => ({ sub: '123', name: 'Coach', email_verified: true, email: 'a@b.com' }) };
    }
  }

  const verify = makeGoogleTokenVerifier(FakeOAuth2Client, 'client-123');
  const payload = await verify('token-abc');

  assert.deepEqual(calls, [{ idToken: 'token-abc', audience: 'client-123' }]);
  assert.equal(payload.sub, '123');

  // No client id configured means Google sign-in is simply unavailable.
  assert.equal(makeGoogleTokenVerifier(FakeOAuth2Client, undefined), null);
});

test('an unverified Google email is dropped so it can never match the allowlist', async () => {
  const verifyIdToken = async () => ({ sub: '123', name: 'Coach', email: 'admin@x.com', email_verified: false });
  const auth = createGoogleAuth({ verifyIdToken, adminEmails: 'admin@x.com', allowUnauthenticated: false });

  const user = await auth.verifyOptionalGoogleUser(headers({ authorization: 'Bearer t' }));
  assert.equal(user.email, undefined);
  assert.equal(auth.isAdminUser(user), false);
  await assert.rejects(
    () => auth.requireAdminGoogleUser(headers({ authorization: 'Bearer t' })),
    error => error instanceof AdminAuthError && error.status === 403,
  );
});

test('a rejected verification surfaces as an AuthError, not the raw failure', async () => {
  const verifyIdToken = async () => { throw new Error('jwt malformed'); };
  const auth = createGoogleAuth({ verifyIdToken, adminEmails: '', allowUnauthenticated: true });
  await assert.rejects(
    () => auth.verifyOptionalGoogleUser(headers({ authorization: 'Bearer bad' })),
    error => error instanceof AuthError && error.message === 'Invalid Google identity token',
  );
});

test('entryAuthFields keeps only the stable account identifier, never profile data', () => {
  assert.deepEqual(entryAuthFields(null), {});
  assert.deepEqual(
    entryAuthFields({
      provider: 'google', providerUserId: 'sub-1', name: 'Coach',
      email: 'secret@x.com', picture: 'https://img',
    }),
    { userId: 'sub-1', authProvider: 'google' },
  );
});
