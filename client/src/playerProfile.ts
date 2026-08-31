import type { PublicPlayerProfile } from './types';

export type PlayerProfilePatch = {
  avatar?: { source: 'upload'; dataUrl: string } | { source: 'google' } | null;
  country?: string;
};

async function profileResponse(response: Response): Promise<PublicPlayerProfile> {
  let body: Partial<PublicPlayerProfile> & { error?: string };
  try { body = await response.json() as Partial<PublicPlayerProfile> & { error?: string }; }
  catch {
    if (!response.ok) throw new Error(`Profile request failed (${response.status})`);
    throw new Error('Profile returned an unreadable response');
  }
  if (!response.ok) throw new Error(body.error ?? 'Profile request failed');
  if (typeof body.userId !== 'string') throw new Error('Profile returned an invalid response');
  return body as PublicPlayerProfile;
}

export async function fetchOwnProfile(idToken: string): Promise<PublicPlayerProfile> {
  const response = await fetch('/api/profile', {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  return profileResponse(response);
}

export async function saveOwnProfile(
  patch: PlayerProfilePatch,
  idToken: string,
): Promise<PublicPlayerProfile> {
  const response = await fetch('/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(patch),
  });
  return profileResponse(response);
}

export function playerAvatarUrl(userId: string, avatarVersion: string): string {
  return `/api/avatar/${encodeURIComponent(userId)}?v=${encodeURIComponent(avatarVersion)}`;
}
