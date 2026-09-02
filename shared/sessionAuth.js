const encoder = new TextEncoder();
const SESSION_ISSUER = 'turn-16';
const SESSION_AUDIENCE = 'turn-16-web';

export class SessionAuthError extends Error {}

function base64UrlEncode(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function jsonPart(value) {
  return base64UrlEncode(encoder.encode(JSON.stringify(value)));
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function signAuthToken(payload, secret, { lifetimeSeconds = 60 * 60 * 24 * 7, now = Date.now() } = {}) {
  if (!secret || secret.length < 32) throw new SessionAuthError('Authentication session secret is not configured');
  const issuedAt = Math.floor(now / 1000);
  const header = jsonPart({ alg: 'HS256', typ: 'JWT' });
  const body = jsonPart({
    iss: SESSION_ISSUER,
    aud: SESSION_AUDIENCE,
    iat: issuedAt,
    exp: issuedAt + lifetimeSeconds,
    ...payload,
  });
  const unsigned = `${header}.${body}`;
  return `${unsigned}.${base64UrlEncode(await hmac(secret, unsigned))}`;
}

export async function verifyAuthToken(token, secret, { now = Date.now() } = {}) {
  if (!secret || secret.length < 32) throw new SessionAuthError('Authentication session secret is not configured');
  const parts = String(token ?? '').split('.');
  if (parts.length !== 3) throw new SessionAuthError('Invalid Turn 16 session');
  const [header, body, signature] = parts;
  let parsedHeader;
  let payload;
  let actualSignature;
  try {
    parsedHeader = JSON.parse(new TextDecoder().decode(base64UrlDecode(header)));
    payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body)));
    actualSignature = base64UrlDecode(signature);
  } catch {
    throw new SessionAuthError('Invalid Turn 16 session');
  }
  if (parsedHeader?.alg !== 'HS256' || parsedHeader?.typ !== 'JWT') {
    throw new SessionAuthError('Invalid Turn 16 session');
  }
  const expectedSignature = await hmac(secret, `${header}.${body}`);
  if (!constantTimeEqual(actualSignature, expectedSignature)) throw new SessionAuthError('Invalid Turn 16 session');
  if (payload?.iss !== SESSION_ISSUER || payload?.aud !== SESSION_AUDIENCE || !payload?.sub) {
    throw new SessionAuthError('Invalid Turn 16 session');
  }
  if (!Number.isFinite(payload.exp) || payload.exp * 1000 <= now) throw new SessionAuthError('Turn 16 session expired');
  return payload;
}

export function normalizeAuthEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new SessionAuthError('Enter a valid email address');
  }
  return email;
}

export function randomAuthToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function hashAuthValue(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return base64UrlEncode(new Uint8Array(digest));
}

export async function providerUserId(provider, subject) {
  if (provider === 'google') return subject;
  return `${provider}-${(await hashAuthValue(`${provider}:${subject}`)).slice(0, 32)}`;
}

export function sessionUserFromPayload(payload) {
  if (payload.purpose !== 'session' || !['google', 'discord', 'email'].includes(payload.provider)) {
    throw new SessionAuthError('Invalid Turn 16 session');
  }
  return {
    provider: payload.provider,
    providerUserId: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    picture: typeof payload.picture === 'string' ? payload.picture : undefined,
  };
}
