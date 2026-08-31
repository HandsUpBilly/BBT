import {
  PlayerProfileValidationError,
  decodeUploadedAvatar,
  normalizeProfileUserId,
} from '../../shared/playerProfile.js';
import { readPlayerProfile } from './profileStore.js';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(req) {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  const url = new URL(req.url);
  const rawUserId = url.searchParams.get('userId') ?? url.pathname.split('/').filter(Boolean).pop();
  let userId;
  try { userId = normalizeProfileUserId(rawUserId); }
  catch (error) {
    if (error instanceof PlayerProfileValidationError) return json({ error: error.message }, 400);
    throw error;
  }

  const profile = await readPlayerProfile(userId);
  if (!profile?.avatar) return new Response(null, { status: 404 });
  if (profile.avatar.source === 'google') {
    return new Response(null, {
      status: 302,
      headers: { Location: profile.avatar.url, 'Cache-Control': 'public, max-age=300' },
    });
  }
  try {
    return new Response(decodeUploadedAvatar(profile.avatar.dataUrl), {
      status: 200,
      headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=300' },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
