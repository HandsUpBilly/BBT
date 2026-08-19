import assert from 'node:assert/strict';
import test from 'node:test';
import { addManagedAdmin, normalizeManagedAdmins, removeManagedAdmin } from './adminManagement.js';

test('managed administrators are valid, deduplicated normalized email addresses', () => {
  assert.deepEqual(normalizeManagedAdmins({ emails: [' Coach@Example.com ', 'coach@example.com', 'not an email'] }), ['coach@example.com']);
  assert.deepEqual(addManagedAdmin([], 'new.admin@example.com'), ['new.admin@example.com']);
  assert.throws(() => addManagedAdmin([], 'not-an-email'), /valid administrator email/);
});

test('removing a managed administrator leaves unrelated addresses unchanged', () => {
  assert.deepEqual(removeManagedAdmin(['a@example.com', 'b@example.com'], 'A@example.com'), ['b@example.com']);
});
