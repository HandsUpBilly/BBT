import assert from 'node:assert/strict';
import test from 'node:test';
import { addManagedAdmin, appendAuditEntry, normalizeAudit, normalizeManagedAdmins, removeManagedAdmin } from './adminManagement.js';

test('managed administrators are valid, deduplicated normalized email addresses', () => {
  assert.deepEqual(normalizeManagedAdmins({ emails: [' Coach@Example.com ', 'coach@example.com', 'not an email'] }), ['coach@example.com']);
  assert.deepEqual(addManagedAdmin([], 'new.admin@example.com'), ['new.admin@example.com']);
  assert.throws(() => addManagedAdmin([], 'not-an-email'), /valid administrator email/);
});

test('removing a managed administrator leaves unrelated addresses unchanged', () => {
  assert.deepEqual(removeManagedAdmin(['a@example.com', 'b@example.com'], 'A@example.com'), ['b@example.com']);
});

test('normalizeAudit drops malformed entries and caps the list at 100', () => {
  assert.deepEqual(normalizeAudit('not an array'), []);
  assert.deepEqual(normalizeAudit([
    { action: 'added', actor: 'a@example.com', target: 'b@example.com', at: '2026-01-01T00:00:00.000Z' },
    { action: 'invalid', actor: 'a@example.com', target: 'b@example.com', at: '2026-01-01T00:00:00.000Z' },
    { action: 'removed', actor: 'a@example.com', target: 'b@example.com' },
    null,
  ]), [{ action: 'added', actor: 'a@example.com', target: 'b@example.com', at: '2026-01-01T00:00:00.000Z' }]);

  const oversized = Array.from({ length: 150 }, (_, index) => (
    { action: 'added', actor: 'a@example.com', target: `${index}@example.com`, at: '2026-01-01T00:00:00.000Z' }
  ));
  assert.equal(normalizeAudit(oversized).length, 100);
});

test('appendAuditEntry prepends a timestamped entry and caps the list at 100', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  assert.deepEqual(
    appendAuditEntry([], { action: 'added', actor: 'a@example.com', target: 'b@example.com' }, now),
    [{ action: 'added', actor: 'a@example.com', target: 'b@example.com', at: '2026-01-01T00:00:00.000Z' }],
  );

  const existing = Array.from({ length: 100 }, (_, index) => (
    { action: 'added', actor: 'a@example.com', target: `${index}@example.com`, at: '2025-01-01T00:00:00.000Z' }
  ));
  const next = appendAuditEntry(existing, { action: 'removed', actor: 'a@example.com', target: 'new@example.com' }, now);
  assert.equal(next.length, 100);
  assert.deepEqual(next[0], { action: 'removed', actor: 'a@example.com', target: 'new@example.com', at: '2026-01-01T00:00:00.000Z' });
});
