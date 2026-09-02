import {
  SessionAuthError,
  normalizeAuthEmail,
  providerUserId,
  randomAuthToken,
  signAuthToken,
  verifyAuthToken,
} from './sessionAuth.js';

export const MAGIC_LINK_LIFETIME_MS = 15 * 60 * 1000;
const OAUTH_STATE_LIFETIME_SECONDS = 10 * 60;

export function authConfiguration(env = process.env) {
  const sessionReady = Boolean(env.AUTH_SESSION_SECRET && env.AUTH_SESSION_SECRET.length >= 32);
  return {
    google: Boolean(env.GOOGLE_CLIENT_ID),
    discord: sessionReady && Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET && env.DISCORD_REDIRECT_URI),
    email: sessionReady && Boolean(env.RESEND_API_KEY && (env.AUTH_EMAIL_FROM || env.CONTACT_EMAIL_FROM)),
  };
}

export async function issueIdentitySession(identity, secret) {
  const email = identity.email ? normalizeAuthEmail(identity.email) : undefined;
  const sub = await providerUserId(identity.provider, identity.subject);
  const token = await signAuthToken({
    purpose: 'session',
    sub,
    provider: identity.provider,
    ...(email ? { email } : {}),
    ...(identity.picture ? { picture: identity.picture } : {}),
  }, secret);
  return {
    token,
    user: {
      id: sub,
      provider: identity.provider,
      ...(email ? { email } : {}),
      ...(identity.picture ? { picture: identity.picture } : {}),
    },
  };
}

export async function makeDiscordAuthorization({ clientId, redirectUri, secret, nonce }) {
  const state = await signAuthToken({
    purpose: 'discord-oauth-state',
    sub: 'oauth-state',
    provider: 'discord',
    nonce,
  }, secret, { lifetimeSeconds: OAUTH_STATE_LIFETIME_SECONDS });
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify email',
    state,
  });
  return `https://discord.com/oauth2/authorize?${params}`;
}

export async function verifyDiscordState(state, cookieNonce, secret) {
  const payload = await verifyAuthToken(state, secret);
  if (payload.purpose !== 'discord-oauth-state' || payload.provider !== 'discord' || !cookieNonce || payload.nonce !== cookieNonce) {
    throw new SessionAuthError('Discord login could not be verified');
  }
}

export async function exchangeDiscordCode({ code, clientId, clientSecret, redirectUri, fetchImpl = fetch }) {
  const tokenResponse = await fetchImpl('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenResponse.ok) throw new SessionAuthError('Discord rejected the login request');
  const tokens = await tokenResponse.json();
  if (typeof tokens.access_token !== 'string') throw new SessionAuthError('Discord returned an incomplete login');

  const userResponse = await fetchImpl('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userResponse.ok) throw new SessionAuthError('Discord profile could not be read');
  const user = await userResponse.json();
  if (typeof user.id !== 'string') throw new SessionAuthError('Discord returned an incomplete profile');
  return {
    provider: 'discord',
    subject: user.id,
    ...(user.verified === true && typeof user.email === 'string' ? { email: user.email } : {}),
  };
}

export function createMagicLinkRecord(email, now = Date.now()) {
  const token = randomAuthToken();
  return {
    token,
    record: {
      email: normalizeAuthEmail(email),
      expiresAt: now + MAGIC_LINK_LIFETIME_MS,
      consumed: false,
    },
  };
}

export function validateMagicLinkRecord(record, now = Date.now()) {
  if (!record || record.consumed || !Number.isFinite(record.expiresAt) || record.expiresAt <= now) {
    throw new SessionAuthError('This email login link is invalid or has expired');
  }
  return normalizeAuthEmail(record.email);
}

export function cookieValue(cookieHeader, name) {
  for (const item of String(cookieHeader ?? '').split(';')) {
    const [key, ...parts] = item.trim().split('=');
    if (key === name) return decodeURIComponent(parts.join('='));
  }
  return null;
}

export function safeAppUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    return url.origin;
  } catch {
    throw new SessionAuthError('Authentication app URL is not configured');
  }
}
