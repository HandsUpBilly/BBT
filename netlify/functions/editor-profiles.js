import {
  PlayerProfileValidationError,
  normalizeProfileUserId,
  toPublicPlayerProfile,
} from '../../shared/playerProfile.js';
import { AdminAuthError, authErrorResponse, requireAdminGoogleUser } from './auth.js';
import { listPlayerProfiles, removePlayerAvatar } from './profileStore.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  });
}

function moderationProfile(profile) {
  return {
    ...toPublicPlayerProfile(profile),
    hasAvatar: Boolean(profile.avatar),
    updatedAt: profile.updatedAt,
  };
}

export default async function handler(req) {
  try { await requireAdminGoogleUser(req); }
  catch (error) {
    if (error instanceof AdminAuthError) return authErrorResponse(error);
    throw error;
  }

  if (req.method === 'GET') {
    const profiles = await listPlayerProfiles();
    return json(profiles.map(moderationProfile));
  }

  if (req.method === 'DELETE') {
    const rawUserId = new URL(req.url).searchParams.get('userId');
    try {
      const userId = normalizeProfileUserId(rawUserId);
      const profile = await removePlayerAvatar(userId);
      if (!profile) return json({ error: 'Avatar not found' }, 404);
      return json(moderationProfile(profile));
    } catch (error) {
      if (error instanceof PlayerProfileValidationError) return json({ error: error.message }, 400);
      throw error;
    }
  }

  return json({ error: 'Method not allowed' }, 405);
}
