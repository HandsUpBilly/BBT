import assert from 'node:assert/strict';
import test from 'node:test';
import { LoginValidationError, recordLogin, sortLogins, validateLoginPayload } from './loginTracking.js';

test('validateLoginPayload trims and length-caps the name', () => {
  assert.deepEqual(validateLoginPayload({ name: '  Coach  ' }), { name: 'Coach' });
  assert.deepEqual(validateLoginPayload({ name: 'x'.repeat(50) }), { name: 'x'.repeat(32) });
});

test('validateLoginPayload rejects a missing or blank name', () => {
  assert.throws(() => validateLoginPayload({}), LoginValidationError);
  assert.throws(() => validateLoginPayload({ name: '   ' }), LoginValidationError);
  assert.throws(() => validateLoginPayload(null), LoginValidationError);
});

test('recordLogin creates a first entry with count 1', () => {
  const { entries, entry } = recordLogin([], { name: 'Coach', user: null }, '2026-08-31T00:00:00.000Z');
  assert.equal(entries.length, 1);
  assert.deepEqual(entry, {
    name: 'Coach',
    firstLoginAt: '2026-08-31T00:00:00.000Z',
    lastLoginAt: '2026-08-31T00:00:00.000Z',
    loginCount: 1,
  });
});

test('recordLogin matches a signed-in player by userId, not by name', () => {
  const user = { provider: 'google', providerUserId: 'g-1' };
  const first = recordLogin([], { name: 'Coach', user }, '2026-08-24T00:00:00.000Z');
  const second = recordLogin(first.entries, { name: 'Coach Renamed', user }, '2026-08-31T00:00:00.000Z');

  assert.equal(second.entries.length, 1);
  assert.equal(second.entry.name, 'Coach Renamed');
  assert.equal(second.entry.firstLoginAt, '2026-08-24T00:00:00.000Z');
  assert.equal(second.entry.lastLoginAt, '2026-08-31T00:00:00.000Z');
  assert.equal(second.entry.loginCount, 2);
  assert.equal(second.entry.userId, 'g-1');
});

test('recordLogin matches a guest by name and keeps a separate signed-in entry with the same name', () => {
  const user = { provider: 'google', providerUserId: 'g-1' };
  const guestLogin = recordLogin([], { name: 'Coach', user: null }, '2026-08-24T00:00:00.000Z');
  const signedInLogin = recordLogin(guestLogin.entries, { name: 'Coach', user }, '2026-08-25T00:00:00.000Z');

  assert.equal(signedInLogin.entries.length, 2);
  assert.equal(signedInLogin.entries[0].loginCount, 1);
  assert.equal(signedInLogin.entries[0].userId, undefined);
  assert.equal(signedInLogin.entries[1].loginCount, 1);
  assert.equal(signedInLogin.entries[1].userId, 'g-1');
});

test('recordLogin increments a returning guest by exact name match', () => {
  const first = recordLogin([], { name: 'Coach', user: null }, '2026-08-24T00:00:00.000Z');
  const second = recordLogin(first.entries, { name: 'Coach', user: null }, '2026-08-31T00:00:00.000Z');

  assert.equal(second.entries.length, 1);
  assert.equal(second.entry.loginCount, 2);
  assert.equal(second.entry.firstLoginAt, '2026-08-24T00:00:00.000Z');
  assert.equal(second.entry.lastLoginAt, '2026-08-31T00:00:00.000Z');
});

test('sortLogins orders most recently active first', () => {
  const entries = [
    { name: 'Old', firstLoginAt: '2026-08-01T00:00:00.000Z', lastLoginAt: '2026-08-01T00:00:00.000Z', loginCount: 1 },
    { name: 'New', firstLoginAt: '2026-08-30T00:00:00.000Z', lastLoginAt: '2026-08-31T00:00:00.000Z', loginCount: 3 },
  ];
  assert.deepEqual(sortLogins(entries).map(entry => entry.name), ['New', 'Old']);
});
