import assert from 'node:assert/strict';
import test from 'node:test';
import { planLoginAdminUpdate } from './loginAdminControl.js';

const googleLogin = (overrides = {}) => ({
  name: 'Coach',
  firstLoginAt: '2026-08-01T00:00:00.000Z',
  lastLoginAt: '2026-08-02T00:00:00.000Z',
  loginCount: 2,
  userId: 'g-1',
  authProvider: 'google',
  adminEmail: 'coach@example.com',
  ...overrides,
});

const plan = (overrides = {}) => planLoginAdminUpdate({
  entries: [googleLogin()],
  userId: 'g-1',
  adding: true,
  current: [],
  configuredAdminCount: 1,
  ...overrides,
});

test('promotes an eligible Google login and reports the private target for the audit', () => {
  assert.deepEqual(plan(), { ok: true, target: 'coach@example.com', managedAdmins: ['coach@example.com'] });
});

test('demotes a managed administrator', () => {
  assert.deepEqual(
    plan({ adding: false, current: ['coach@example.com', 'other@example.com'] }),
    { ok: true, target: 'coach@example.com', managedAdmins: ['other@example.com'] },
  );
});

test('refuses a login that carries no verified Google address', () => {
  const refusal = {
    ok: false,
    status: 400,
    errors: ['This login is not a verified Google account.'],
  };

  // A guest: no userId and no provider.
  assert.deepEqual(
    plan({ entries: [{ name: 'Guest', firstLoginAt: '', lastLoginAt: '', loginCount: 1 }], userId: 'g-1' }),
    refusal,
  );
  // Another identity provider — only Google addresses are trusted for the
  // allowlist, so Discord and magic-link logins can never be promoted.
  assert.deepEqual(plan({ entries: [googleLogin({ authProvider: 'discord' })] }), refusal);
  // A Google login recorded before adminEmail was captured.
  assert.deepEqual(plan({ entries: [googleLogin({ adminEmail: undefined })] }), refusal);
  // An id that matches nothing.
  assert.deepEqual(plan({ userId: 'nobody' }), refusal);
  // A missing id, and a non-string one (`?userId[]=g-1`) that must not be
  // coerced into a match.
  assert.deepEqual(plan({ userId: undefined }), refusal);
  assert.deepEqual(plan({ userId: ['g-1'] }), refusal);
});

test('refuses to revoke an address the endpoint does not manage', () => {
  // In ADMIN_EMAILS or the permanent owner: nothing comes off the list.
  assert.deepEqual(plan({ adding: false, current: ['someone-else@example.com'] }), {
    ok: false,
    status: 404,
    errors: ['That administrator is managed by deployment configuration or does not exist.'],
  });
});

test('keeps the last managed administrator when nothing else is configured', () => {
  // Only reachable in an unauthenticated local environment: with no deployment
  // allowlist, demoting the last managed admin would lock the editor out.
  assert.deepEqual(
    plan({ adding: false, current: ['coach@example.com'], configuredAdminCount: 0 }),
    {
      ok: false,
      status: 400,
      errors: ['Keep at least one managed administrator, or configure ADMIN_EMAILS.'],
    },
  );

  // A real deployment always carries the permanent owner, so the same demotion
  // is allowed there — an administrator still remains.
  assert.deepEqual(
    plan({ adding: false, current: ['coach@example.com'], configuredAdminCount: 1 }),
    { ok: true, target: 'coach@example.com', managedAdmins: [] },
  );
});

test('promotion is idempotent and never duplicates an existing administrator', () => {
  assert.deepEqual(
    plan({ current: ['coach@example.com'] }),
    { ok: true, target: 'coach@example.com', managedAdmins: ['coach@example.com'] },
  );
});

test('matches the stored address case-insensitively', () => {
  assert.deepEqual(
    plan({ entries: [googleLogin({ adminEmail: 'Coach@Example.com' })], adding: false, current: ['coach@example.com'], configuredAdminCount: 1 }),
    { ok: true, target: 'coach@example.com', managedAdmins: [] },
  );
});
