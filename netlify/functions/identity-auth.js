import { getStore } from '@netlify/blobs';
import { AuthError, verifyGoogleCredential } from './auth.js';
import {
  SessionAuthError,
  hashAuthValue,
  randomAuthToken,
} from '../../shared/sessionAuth.js';
import {
  authConfiguration,
  cookieValue,
  createMagicLinkRecord,
  exchangeDiscordCode,
  issueIdentitySession,
  makeDiscordAuthorization,
  safeAppUrl,
  validateMagicLinkRecord,
  verifyDiscordState,
} from '../../shared/identityFlow.js';
import {
  AuthEmailConfigurationError,
  AuthEmailDeliveryError,
  sendMagicLinkEmail,
} from '../../shared/authEmail.js';
import { MAGIC_LINK_RATE_LIMIT, createRateLimiter, rateLimitKey } from '../../shared/rateLimit.js';

const takeMagicLinkToken = createRateLimiter(MAGIC_LINK_RATE_LIMIT);

function store() {
  return getStore({
    name: 'auth-magic-links',
    siteID: process.env.NETLIFY_SITE_ID ?? process.env.SITE_ID,
    token: process.env.NETLIFY_TOKEN ?? process.env.NETLIFY_AUTH_TOKEN,
  });
}

function configuration() {
  return authConfiguration(process.env);
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}

function redirect(location, headers = {}) {
  return new Response(null, { status: 302, headers: { Location: location, 'Cache-Control': 'no-store', ...headers } });
}

function appUrl(req) {
  return safeAppUrl(process.env.AUTH_APP_URL ?? new URL(req.url).origin);
}

function actionFrom(req) {
  const path = new URL(req.url).pathname;
  return path.split('/identity-auth/')[1] ?? path.split('/api/auth/')[1] ?? '';
}

async function body(req) {
  try {
    return await req.json();
  } catch {
    throw new SessionAuthError('Invalid login request');
  }
}

function errorResponse(error) {
  if (error instanceof SessionAuthError || error instanceof AuthError) return json({ error: error.message }, 400);
  if (error instanceof AuthEmailConfigurationError) return json({ error: error.message }, 503);
  if (error instanceof AuthEmailDeliveryError) return json({ error: error.message }, 502);
  throw error;
}

export default async function handler(req) {
  const action = actionFrom(req);
  try {
    if (action === 'config' && req.method === 'GET') return json(configuration());

    if (action === 'google' && req.method === 'POST') {
      if (!configuration().google) throw new SessionAuthError('Google login is not configured');
      const requestBody = await body(req);
      const payload = await verifyGoogleCredential(requestBody.credential);
      if (!payload?.sub) throw new SessionAuthError('Google returned an incomplete profile');
      if (!process.env.AUTH_SESSION_SECRET || process.env.AUTH_SESSION_SECRET.length < 32) {
        return json({
          token: requestBody.credential,
          user: {
            id: payload.sub,
            provider: 'google',
            ...(payload.email_verified && payload.email ? { email: payload.email } : {}),
            ...(typeof payload.picture === 'string' ? { picture: payload.picture } : {}),
          },
        });
      }
      return json(await issueIdentitySession({
        provider: 'google',
        subject: payload.sub,
        ...(payload.email_verified && payload.email ? { email: payload.email } : {}),
        ...(typeof payload.picture === 'string' ? { picture: payload.picture } : {}),
      }, process.env.AUTH_SESSION_SECRET));
    }

    if (action === 'email/start' && req.method === 'POST') {
      if (!configuration().email) throw new AuthEmailConfigurationError('Email login is not configured');
      const limit = takeMagicLinkToken(rateLimitKey({ getHeader: name => req.headers.get(name) }));
      if (!limit.allowed) {
        return json(
          { error: 'Too many login emails. Wait a while and try again.' },
          429,
          { 'Retry-After': String(limit.retryAfterSeconds) },
        );
      }
      const { token, record } = createMagicLinkRecord((await body(req)).email);
      const key = await hashAuthValue(token);
      const magicStore = store();
      await magicStore.set(key, JSON.stringify(record), { onlyIfNew: true });
      try {
        await sendMagicLinkEmail({ email: record.email, link: `${appUrl(req)}/#magic=${encodeURIComponent(token)}` });
      } catch (error) {
        await magicStore.delete(key).catch(() => {});
        throw error;
      }
      return json({ sent: true }, 202);
    }

    if (action === 'email/verify' && req.method === 'POST') {
      if (!configuration().email) throw new AuthEmailConfigurationError('Email login is not configured');
      const token = (await body(req)).token;
      if (typeof token !== 'string') throw new SessionAuthError('This email login link is invalid or has expired');
      const key = await hashAuthValue(token);
      const magicStore = store();
      const current = await magicStore.getWithMetadata(key, { type: 'text' });
      let record;
      try {
        record = JSON.parse(current?.data ?? 'null');
      } catch {
        record = null;
      }
      const email = validateMagicLinkRecord(record);
      let consumed;
      try {
        consumed = await magicStore.set(key, JSON.stringify({ ...record, consumed: true }), {
          ...(current?.etag ? { onlyIfMatch: current.etag } : { onlyIfNew: true }),
        });
      } catch {
        throw new SessionAuthError('This email login link has already been used');
      }
      if (consumed?.modified === false) throw new SessionAuthError('This email login link has already been used');
      const session = await issueIdentitySession({ provider: 'email', subject: email, email }, process.env.AUTH_SESSION_SECRET);
      await magicStore.delete(key).catch(() => {});
      return json(session);
    }

    if (action === 'discord/start' && req.method === 'GET') {
      if (!configuration().discord) throw new SessionAuthError('Discord login is not configured');
      const nonce = randomAuthToken(24);
      const location = await makeDiscordAuthorization({
        clientId: process.env.DISCORD_CLIENT_ID,
        redirectUri: process.env.DISCORD_REDIRECT_URI,
        secret: process.env.AUTH_SESSION_SECRET,
        nonce,
      });
      return redirect(location, {
        'Set-Cookie': `bbt_oauth_state=${encodeURIComponent(nonce)}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/api/auth/discord`,
      });
    }

    if (action === 'discord/callback' && req.method === 'GET') {
      const url = new URL(req.url);
      const clearCookie = 'bbt_oauth_state=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/api/auth/discord';
      try {
        if (!configuration().discord) throw new SessionAuthError('Discord login is not configured');
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        if (!code || !state) throw new SessionAuthError('Discord login was cancelled');
        await verifyDiscordState(state, cookieValue(req.headers.get('cookie'), 'bbt_oauth_state'), process.env.AUTH_SESSION_SECRET);
        const identity = await exchangeDiscordCode({
          code,
          clientId: process.env.DISCORD_CLIENT_ID,
          clientSecret: process.env.DISCORD_CLIENT_SECRET,
          redirectUri: process.env.DISCORD_REDIRECT_URI,
        });
        const session = await issueIdentitySession(identity, process.env.AUTH_SESSION_SECRET);
        return redirect(`${appUrl(req)}/#auth=${encodeURIComponent(session.token)}`, { 'Set-Cookie': clearCookie });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Discord login failed';
        return redirect(`${appUrl(req)}/#login_error=${encodeURIComponent(message)}`, { 'Set-Cookie': clearCookie });
      }
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (error) {
    return errorResponse(error);
  }
}
