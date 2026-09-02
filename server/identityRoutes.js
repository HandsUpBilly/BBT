import { AuthError, verifyGoogleCredential } from './auth.js';
import {
  SessionAuthError,
  hashAuthValue,
  randomAuthToken,
} from '../shared/sessionAuth.js';
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
} from '../shared/identityFlow.js';
import {
  AuthEmailConfigurationError,
  AuthEmailDeliveryError,
  sendMagicLinkEmail,
} from '../shared/authEmail.js';
import { MAGIC_LINK_RATE_LIMIT, createRateLimiter, rateLimitKey } from '../shared/rateLimit.js';

const magicLinks = new Map();
const takeMagicLinkToken = createRateLimiter(MAGIC_LINK_RATE_LIMIT);

function appUrl() {
  return safeAppUrl(process.env.AUTH_APP_URL ?? 'http://localhost:5173');
}

function config() {
  return authConfiguration(process.env);
}

function authError(res, error) {
  if (error instanceof SessionAuthError || error instanceof AuthError) {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof AuthEmailConfigurationError) return res.status(503).json({ error: error.message });
  if (error instanceof AuthEmailDeliveryError) return res.status(502).json({ error: error.message });
  throw error;
}

export function registerIdentityRoutes(app) {
  app.get('/api/auth/config', (_req, res) => res.json(config()));

  app.post('/api/auth/google', async (req, res) => {
    try {
      if (!config().google) throw new SessionAuthError('Google login is not configured');
      const payload = await verifyGoogleCredential(req.body?.credential);
      if (!payload?.sub) throw new SessionAuthError('Google returned an incomplete profile');
      if (!process.env.AUTH_SESSION_SECRET || process.env.AUTH_SESSION_SECRET.length < 32) {
        return res.json({
          token: req.body.credential,
          user: {
            id: payload.sub,
            provider: 'google',
            ...(payload.email_verified && payload.email ? { email: payload.email } : {}),
            ...(typeof payload.picture === 'string' ? { picture: payload.picture } : {}),
          },
        });
      }
      const session = await issueIdentitySession({
        provider: 'google',
        subject: payload.sub,
        ...(payload.email_verified && payload.email ? { email: payload.email } : {}),
        ...(typeof payload.picture === 'string' ? { picture: payload.picture } : {}),
      }, process.env.AUTH_SESSION_SECRET);
      return res.json(session);
    } catch (error) {
      return authError(res, error);
    }
  });

  app.post('/api/auth/email/start', async (req, res) => {
    try {
      if (!config().email) throw new AuthEmailConfigurationError('Email login is not configured');
      const limit = takeMagicLinkToken(rateLimitKey({ remoteAddress: req.ip }));
      if (!limit.allowed) {
        res.set('Retry-After', String(limit.retryAfterSeconds));
        return res.status(429).json({ error: 'Too many login emails. Wait a while and try again.' });
      }
      const { token, record } = createMagicLinkRecord(req.body?.email);
      const hash = await hashAuthValue(token);
      magicLinks.set(hash, record);
      try {
        await sendMagicLinkEmail({ email: record.email, link: `${appUrl()}/#magic=${encodeURIComponent(token)}` });
      } catch (error) {
        magicLinks.delete(hash);
        throw error;
      }
      return res.status(202).json({ sent: true });
    } catch (error) {
      return authError(res, error);
    }
  });

  app.post('/api/auth/email/verify', async (req, res) => {
    try {
      if (!config().email) throw new AuthEmailConfigurationError('Email login is not configured');
      const token = typeof req.body?.token === 'string' ? req.body.token : '';
      const hash = await hashAuthValue(token);
      const record = magicLinks.get(hash);
      const email = validateMagicLinkRecord(record);
      magicLinks.set(hash, { ...record, consumed: true });
      const session = await issueIdentitySession({ provider: 'email', subject: email, email }, process.env.AUTH_SESSION_SECRET);
      magicLinks.delete(hash);
      return res.json(session);
    } catch (error) {
      return authError(res, error);
    }
  });

  app.get('/api/auth/discord/start', async (_req, res) => {
    try {
      if (!config().discord) throw new SessionAuthError('Discord login is not configured');
      const nonce = randomAuthToken(24);
      const url = await makeDiscordAuthorization({
        clientId: process.env.DISCORD_CLIENT_ID,
        redirectUri: process.env.DISCORD_REDIRECT_URI,
        secret: process.env.AUTH_SESSION_SECRET,
        nonce,
      });
      res.cookie('bbt_oauth_state', nonce, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000,
        path: '/api/auth/discord',
      });
      return res.redirect(302, url);
    } catch (error) {
      return authError(res, error);
    }
  });

  app.get('/api/auth/discord/callback', async (req, res) => {
    const clearCookie = () => res.clearCookie('bbt_oauth_state', { path: '/api/auth/discord' });
    try {
      if (!config().discord) throw new SessionAuthError('Discord login is not configured');
      if (typeof req.query.code !== 'string' || typeof req.query.state !== 'string') {
        throw new SessionAuthError('Discord login was cancelled');
      }
      await verifyDiscordState(
        req.query.state,
        cookieValue(req.get('cookie'), 'bbt_oauth_state'),
        process.env.AUTH_SESSION_SECRET,
      );
      const identity = await exchangeDiscordCode({
        code: req.query.code,
        clientId: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        redirectUri: process.env.DISCORD_REDIRECT_URI,
      });
      const session = await issueIdentitySession(identity, process.env.AUTH_SESSION_SECRET);
      clearCookie();
      return res.redirect(302, `${appUrl()}/#auth=${encodeURIComponent(session.token)}`);
    } catch (error) {
      clearCookie();
      const message = error instanceof Error ? error.message : 'Discord login failed';
      return res.redirect(302, `${appUrl()}/#login_error=${encodeURIComponent(message)}`);
    }
  });
}
