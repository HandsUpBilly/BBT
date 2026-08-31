import {
  PlayerProfileValidationError,
  decodeUploadedAvatar,
  normalizeProfileUserId,
  toPublicPlayerProfile,
  updatePlayerProfile,
} from '../shared/playerProfile.js';
import { PROFILE_RATE_LIMIT, createRateLimiter, rateLimitKey } from '../shared/rateLimit.js';
import {
  AdminAuthError,
  requireAdminGoogleUser,
  requireVerifiedGoogleUser,
} from './auth.js';
import {
  listPlayerProfiles,
  readPlayerProfile,
  removePlayerAvatar,
  writePlayerProfile,
} from './profileStore.js';

const takeProfileToken = createRateLimiter(PROFILE_RATE_LIMIT);

function authError(res, error) {
  return res.status(error.status).json({ error: error.message, errors: [error.message] });
}

export function registerPlayerProfileRoutes(app) {
  app.get('/api/profile', async (req, res) => {
    let user;
    try { user = await requireVerifiedGoogleUser(req); }
    catch (error) {
      if (error instanceof AdminAuthError) return authError(res, error);
      throw error;
    }
    const profile = await readPlayerProfile(user.providerUserId);
    res.set({ 'Cache-Control': 'private, no-store', Vary: 'Authorization' });
    return res.json(toPublicPlayerProfile(profile) ?? { userId: user.providerUserId });
  });

  app.put('/api/profile', async (req, res) => {
    let user;
    try { user = await requireVerifiedGoogleUser(req); }
    catch (error) {
      if (error instanceof AdminAuthError) return authError(res, error);
      throw error;
    }

    const limit = takeProfileToken(rateLimitKey({ user, remoteAddress: req.ip }));
    if (!limit.allowed) {
      res.set('Retry-After', String(limit.retryAfterSeconds));
      return res.status(429).json({ error: 'Too many profile changes. Please wait and try again.' });
    }

    try {
      const next = updatePlayerProfile(await readPlayerProfile(user.providerUserId), user, req.body);
      await writePlayerProfile(next);
      res.set({ 'Cache-Control': 'private, no-store', Vary: 'Authorization' });
      return res.json(toPublicPlayerProfile(next));
    } catch (error) {
      if (error instanceof PlayerProfileValidationError) return res.status(400).json({ error: error.message });
      throw error;
    }
  });

  app.get('/api/avatar/:userId', async (req, res) => {
    let userId;
    try { userId = normalizeProfileUserId(req.params.userId); }
    catch (error) {
      if (error instanceof PlayerProfileValidationError) return res.status(400).json({ error: error.message });
      throw error;
    }
    const profile = await readPlayerProfile(userId);
    if (!profile?.avatar) return res.status(404).end();
    res.set('Cache-Control', 'public, max-age=300');
    if (profile.avatar.source === 'google') return res.redirect(302, profile.avatar.url);
    try {
      return res.type('image/webp').send(Buffer.from(decodeUploadedAvatar(profile.avatar.dataUrl)));
    } catch {
      return res.status(404).end();
    }
  });

  app.get('/api/editor/profiles', async (req, res) => {
    try { await requireAdminGoogleUser(req); }
    catch (error) {
      if (error instanceof AdminAuthError) return authError(res, error);
      throw error;
    }
    const profiles = await listPlayerProfiles();
    return res.json(profiles.map(profile => ({
      ...toPublicPlayerProfile(profile),
      hasAvatar: Boolean(profile.avatar),
      updatedAt: profile.updatedAt,
    })));
  });

  app.delete('/api/editor/profiles', async (req, res) => {
    try { await requireAdminGoogleUser(req); }
    catch (error) {
      if (error instanceof AdminAuthError) return authError(res, error);
      throw error;
    }
    try {
      const userId = normalizeProfileUserId(req.query.userId);
      const profile = await removePlayerAvatar(userId);
      if (!profile) return res.status(404).json({ error: 'Avatar not found' });
      return res.json({ ...toPublicPlayerProfile(profile), hasAvatar: false, updatedAt: profile.updatedAt });
    } catch (error) {
      if (error instanceof PlayerProfileValidationError) return res.status(400).json({ error: error.message });
      throw error;
    }
  });
}
