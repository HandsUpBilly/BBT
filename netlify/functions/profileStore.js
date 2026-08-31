import { getStore } from '@netlify/blobs';
import { toPublicPlayerProfile } from '../../shared/playerProfile.js';

const PROFILE_PREFIX = 'profile:';

function store() {
  return getStore({
    name: 'player-profiles',
    siteID: process.env.NETLIFY_SITE_ID ?? process.env.SITE_ID,
    token: process.env.NETLIFY_TOKEN ?? process.env.NETLIFY_AUTH_TOKEN,
  });
}

function key(userId) { return `${PROFILE_PREFIX}${userId}`; }

export async function readPlayerProfile(userId) {
  const raw = await store().get(key(userId), { type: 'text' });
  if (!raw) return null;
  try {
    const profile = JSON.parse(raw);
    return profile && typeof profile === 'object' && profile.userId === userId ? profile : null;
  } catch {
    return null;
  }
}

export async function writePlayerProfile(profile) {
  await store().set(key(profile.userId), JSON.stringify(profile));
  return profile;
}

export async function listPlayerProfiles() {
  const result = await store().list({ prefix: PROFILE_PREFIX });
  const profiles = await Promise.all(result.blobs.map(blob => readPlayerProfile(blob.key.slice(PROFILE_PREFIX.length))));
  return profiles.filter(Boolean);
}

export async function removePlayerAvatar(userId, now = new Date().toISOString()) {
  const profile = await readPlayerProfile(userId);
  if (!profile?.avatar) return null;
  const next = { ...profile, updatedAt: now };
  delete next.avatar;
  delete next.avatarUpdatedAt;
  await writePlayerProfile(next);
  return next;
}

/** Public profile decoration must never make the leaderboard itself fail. */
export async function enrichEntriesWithProfiles(entries) {
  try {
    const ids = [...new Set(entries.map(entry => entry.userId).filter(Boolean))];
    const profiles = new Map(await Promise.all(ids.map(async id => [id, await readPlayerProfile(id)])));
    return entries.map(entry => {
      const profile = entry.userId ? toPublicPlayerProfile(profiles.get(entry.userId)) : null;
      return profile ? { ...entry, profile } : entry;
    });
  } catch {
    return entries;
  }
}
