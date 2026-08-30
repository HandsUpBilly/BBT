import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ContactValidationError,
  buildContactEmail,
  validateContactPayload,
} from './contactMessage.js';
import { ContactConfigurationError, sendContactEmail } from './resendEmail.js';

const validPayload = {
  name: 'Guest Coach',
  email: 'coach@example.com',
  message: 'Love the app — any plans for a Nurgle team?',
};

test('validates a contact message', () => {
  const contact = validateContactPayload(validPayload);
  assert.deepEqual(contact, validPayload);
});

test('rejects missing fields', () => {
  assert.throws(() => validateContactPayload({ ...validPayload, name: '' }), ContactValidationError);
  assert.throws(() => validateContactPayload({ ...validPayload, email: '' }), ContactValidationError);
  assert.throws(() => validateContactPayload({ ...validPayload, message: '' }), ContactValidationError);
});

test('rejects a malformed email address', () => {
  assert.throws(() => validateContactPayload({ ...validPayload, email: 'not-an-email' }), ContactValidationError);
});

test('rejects a name or email containing a line break', () => {
  assert.throws(
    () => validateContactPayload({ ...validPayload, name: 'Guest\nBcc: evil@example.com' }),
    ContactValidationError,
  );
  assert.throws(
    () => validateContactPayload({ ...validPayload, email: 'coach@example.com\nBcc: evil@example.com' }),
    ContactValidationError,
  );
});

test('allows a multi-line message', () => {
  const contact = validateContactPayload({ ...validPayload, message: 'Line one.\nLine two.' });
  assert.equal(contact.message, 'Line one.\nLine two.');
});

test('trims whitespace and enforces length limits', () => {
  const contact = validateContactPayload({ ...validPayload, name: '  Guest Coach  ' });
  assert.equal(contact.name, 'Guest Coach');
  assert.throws(
    () => validateContactPayload({ ...validPayload, message: 'x'.repeat(5000) }),
    ContactValidationError,
  );
});

test('builds an email with the reporter identified in the body', () => {
  const contact = validateContactPayload(validPayload);
  const email = buildContactEmail(contact, '2026-08-01T00:00:00.000Z');
  assert.equal(email.subject, 'Turn 16 contact message from Guest Coach');
  assert.ok(email.text.includes('coach@example.com'));
  assert.ok(email.text.includes(contact.message));
});

test('sends via the Resend API with the reply-to set to the sender', async () => {
  let request;
  const contact = validateContactPayload(validPayload);
  const email = buildContactEmail(contact, '2026-08-01T00:00:00.000Z');
  const sent = await sendContactEmail(contact, email, {
    apiKey: 'test-key',
    to: 'owner@turn-16.com',
    from: 'contact@turn-16.com',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ id: 'abc123' }) };
    },
  });
  assert.equal(request.url, 'https://api.resend.com/emails');
  assert.equal(request.options.headers.Authorization, 'Bearer test-key');
  const body = JSON.parse(request.options.body);
  assert.deepEqual(body.to, ['owner@turn-16.com']);
  assert.equal(body.from, 'contact@turn-16.com');
  assert.equal(body.reply_to, 'coach@example.com');
  assert.equal(sent.id, 'abc123');
});

test('requires configured credentials', async () => {
  const contact = validateContactPayload(validPayload);
  const email = buildContactEmail(contact);
  await assert.rejects(
    () => sendContactEmail(contact, email, { apiKey: '', to: 'owner@turn-16.com', from: 'contact@turn-16.com' }),
    ContactConfigurationError,
  );
  await assert.rejects(
    () => sendContactEmail(contact, email, { apiKey: 'test-key', to: '', from: 'contact@turn-16.com' }),
    ContactConfigurationError,
  );
});
