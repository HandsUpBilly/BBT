import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { toPublicPlayerProfile } from '../shared/playerProfile.js';

const PROFILE_STORE_PATH = join(process.cwd(), '..', '.bbt-player-profiles.json');

async function readAllProfiles() {
  try {
    const value = JSON.parse(await readFile(PROFILE_STORE_PATH, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return {};
    throw error;
  }
}

export async function readPlayerProfile(userId) {
  return (await readAllProfiles())[userId] ?? null;
}

export async function writePlayerProfile(profile) {
  const profiles = await readAllProfiles();
  profiles[profile.userId] = profile;
  await writeFile(PROFILE_STORE_PATH, `${JSON.stringify(profiles, null, 2)}\n`);
  return profile;
}

export async function listPlayerProfiles() {
  return Object.values(await readAllProfiles());
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
