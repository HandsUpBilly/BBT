import {
  ContactValidationError,
  buildContactEmail,
  validateContactPayload,
} from '../../shared/contactMessage.js';
import {
  ContactConfigurationError,
  ContactDeliveryError,
  sendContactEmail,
} from '../../shared/resendEmail.js';
import { CONTACT_RATE_LIMIT, createRateLimiter, rateLimitKey } from '../../shared/rateLimit.js';

// Per-instance limiter — see reports.js for why this is an accepted trade-off.
const takeContactToken = createRateLimiter(CONTACT_RATE_LIMIT);

function json(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  let contact;
  try {
    contact = validateContactPayload(payload);
  } catch (error) {
    if (error instanceof ContactValidationError) return json({ error: error.message }, 400);
    throw error;
  }

  // Open to guests too — there is no identity to key on here.
  const key = rateLimitKey({ getHeader: name => req.headers.get(name) });
  const { allowed, retryAfterSeconds } = takeContactToken(key);
  if (!allowed) {
    return json(
      { error: 'Too many messages from this session. Try again later.' },
      429,
      { 'Retry-After': String(retryAfterSeconds) },
    );
  }

  const emailContent = buildContactEmail(contact);
  try {
    const sent = await sendContactEmail(contact, emailContent);
    return json(sent, 201);
  } catch (error) {
    if (error instanceof ContactConfigurationError) return json({ error: error.message }, 503);
    if (error instanceof ContactDeliveryError) return json({ error: error.message }, 502);
    throw error;
  }
}
