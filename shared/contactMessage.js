// Isomorphic contact-message validation + email content building.
//
// Mirrors reporting.js's split: this file has no Node/browser API so the
// client validates exactly the way the server does. The actual send (Resend
// API call + credentials) lives in resendEmail.js (server-only).

export const CONTACT_LIMITS = {
  name: 64,
  email: 254,
  message: 4000,
};

export class ContactValidationError extends Error {}

// Deliberately loose — just enough to catch an obvious typo without rejecting
// anything RFC 5321 actually allows. This is a reply-to address, not a login:
// a false negative here just means a bounced reply, not a security hole.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Name and email become email headers (display name, Reply-To), so a line
 * break in either would be header-injection-shaped input even though the
 * transactional API takes structured JSON rather than raw SMTP text. */
function requiredSingleLine(value, field, maxLength) {
  if (typeof value !== 'string') throw new ContactValidationError(`${field} is required`);
  const trimmed = value.trim();
  if (!trimmed) throw new ContactValidationError(`${field} is required`);
  if (trimmed.length > maxLength) throw new ContactValidationError(`${field} is too long`);
  if (/[\r\n]/.test(trimmed)) throw new ContactValidationError(`${field} cannot contain line breaks`);
  return trimmed;
}

function optionalSingleLine(value, field, maxLength) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new ContactValidationError(`${field} must be text`);
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length > maxLength) throw new ContactValidationError(`${field} is too long`);
  if (/[\r\n]/.test(trimmed)) throw new ContactValidationError(`${field} cannot contain line breaks`);
  return trimmed;
}

function requiredText(value, field, maxLength) {
  if (typeof value !== 'string') throw new ContactValidationError(`${field} is required`);
  const trimmed = value.trim();
  if (!trimmed) throw new ContactValidationError(`${field} is required`);
  if (trimmed.length > maxLength) throw new ContactValidationError(`${field} is too long`);
  return trimmed;
}

export function validateContactPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ContactValidationError('Invalid contact payload');
  }

  const name = requiredSingleLine(payload.name, 'name', CONTACT_LIMITS.name);
  const email = optionalSingleLine(payload.email, 'email', CONTACT_LIMITS.email);
  if (email && !EMAIL_PATTERN.test(email)) throw new ContactValidationError('email is not a valid address');
  const message = requiredText(payload.message, 'message', CONTACT_LIMITS.message);

  return { name, email, message };
}

export function buildContactEmail(contact, submittedAt = new Date().toISOString()) {
  return {
    subject: `Turn 16 contact message from ${contact.name}`,
    text: [
      contact.email
        ? `From: ${contact.name} <${contact.email}>`
        : `From: ${contact.name} (no reply address supplied)`,
      `Submitted: ${submittedAt}`,
      '',
      contact.message,
    ].join('\n'),
  };
}
