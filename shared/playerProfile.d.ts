export const PLAYER_PROFILE_LIMITS: {
  readonly avatarBytes: number;
  readonly avatarDataUrlLength: number;
  readonly avatarPixels: number;
  readonly countryLength: number;
  readonly googlePictureUrlLength: number;
};

export class PlayerProfileValidationError extends Error {
}

export interface StoredPlayerProfile {
  userId: string;
  country?: string;
  avatar?:
    | { source: 'upload'; dataUrl: string }
    | { source: 'google'; url: string };
  avatarUpdatedAt?: string;
  updatedAt?: string;
}

export interface PublicPlayerProfile {
  userId: string;
  country?: string;
  avatarVersion?: string;
}

export interface ProfilePatch {
  country?: string | null;
  avatar?:
    | null
    | { source: 'upload'; dataUrl: string }
    | { source: 'google' };
}

export function normalizeProfileUserId(userId: unknown): string;
export function decodeUploadedAvatar(dataUrl: unknown): Uint8Array;
export function updatePlayerProfile(
  existing: StoredPlayerProfile | null | undefined,
  user: { providerUserId: string; picture?: string },
  input: ProfilePatch,
  now?: string,
): StoredPlayerProfile;
export function toPublicPlayerProfile(
  profile: StoredPlayerProfile | null | undefined,
): PublicPlayerProfile | null;
