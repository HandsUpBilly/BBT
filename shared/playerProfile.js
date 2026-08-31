// Public player-profile validation shared by Express and Netlify Functions.
// This module deliberately has no package imports; see AGENTS.md's shared/
// dependency rule.

export const PLAYER_PROFILE_LIMITS = Object.freeze({
  avatarBytes: 150_000,
  avatarDataUrlLength: 200_000,
  avatarPixels: 256,
  countryLength: 64,
  googlePictureUrlLength: 2_048,
});

const USER_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const WEBP_PREFIX = 'data:image/webp;base64,';

export class PlayerProfileValidationError extends Error {}

export function normalizeProfileUserId(value) {
  const userId = typeof value === 'string' ? value.trim() : '';
  if (!USER_ID_RE.test(userId)) throw new PlayerProfileValidationError('Invalid player profile id');
  return userId;
}

function bytesFromBase64(value) {
  let binary;
  try {
    binary = atob(value);
  } catch {
    throw new PlayerProfileValidationError('Avatar image is not valid base64');
  }
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function ascii(bytes, offset, length) {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function webpDimensions(bytes) {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') {
    throw new PlayerProfileValidationError('Avatar must be a valid WebP image');
  }

  const chunk = ascii(bytes, 12, 4);
  if (chunk === 'VP8X') {
    return {
      width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
      height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
    };
  }

  if (chunk === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return {
      width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
      height: (bytes[28] | (bytes[29] << 8)) & 0x3fff,
    };
  }

  if (chunk === 'VP8L' && bytes[20] === 0x2f) {
    return {
      width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
      height: 1 + ((bytes[22] & 0xc0) >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10),
    };
  }

  throw new PlayerProfileValidationError('Avatar uses an unsupported WebP encoding');
}

export function decodeUploadedAvatar(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith(WEBP_PREFIX)
    || dataUrl.length > PLAYER_PROFILE_LIMITS.avatarDataUrlLength) {
    throw new PlayerProfileValidationError('Avatar must be a processed WebP image');
  }

  const bytes = bytesFromBase64(dataUrl.slice(WEBP_PREFIX.length));
  if (bytes.length === 0 || bytes.length > PLAYER_PROFILE_LIMITS.avatarBytes) {
    throw new PlayerProfileValidationError('Avatar image is too large');
  }

  const { width, height } = webpDimensions(bytes);
  if (width !== PLAYER_PROFILE_LIMITS.avatarPixels || height !== PLAYER_PROFILE_LIMITS.avatarPixels) {
    throw new PlayerProfileValidationError('Avatar must be 256 by 256 pixels');
  }

  return bytes;
}

function normalizeGooglePicture(value) {
  if (typeof value !== 'string' || value.length > PLAYER_PROFILE_LIMITS.googlePictureUrlLength) {
    throw new PlayerProfileValidationError('No Google profile picture is available');
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new PlayerProfileValidationError('Google profile picture URL is invalid');
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || (host !== 'googleusercontent.com' && !host.endsWith('.googleusercontent.com'))) {
    throw new PlayerProfileValidationError('Google profile picture URL is invalid');
  }
  return url.toString();
}

function normalizeCountry(value) {
  if (typeof value !== 'string') throw new PlayerProfileValidationError('Country or nationality must be text');
  const country = value.trim().replace(/\s+/g, ' ');
  if (country.length > PLAYER_PROFILE_LIMITS.countryLength || /[\u0000-\u001f\u007f]/.test(country)) {
    throw new PlayerProfileValidationError('Country or nationality is too long or contains invalid characters');
  }
  return country;
}

/** Validates and applies a partial profile update for one verified Google user. */
export function updatePlayerProfile(existing, user, input, now = new Date().toISOString()) {
  if (!user?.providerUserId) throw new PlayerProfileValidationError('A verified Google account is required');
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new PlayerProfileValidationError('Invalid player profile');
  }

  const hasAvatar = Object.hasOwn(input, 'avatar');
  const hasCountry = Object.hasOwn(input, 'country');
  if (!hasAvatar && !hasCountry) throw new PlayerProfileValidationError('No profile changes were provided');

  const userId = normalizeProfileUserId(user.providerUserId);
  const next = { ...(existing ?? {}), userId, updatedAt: now };

  if (hasCountry) {
    const country = normalizeCountry(input.country);
    if (country) next.country = country;
    else delete next.country;
  }

  if (hasAvatar) {
    if (input.avatar === null) {
      delete next.avatar;
      delete next.avatarUpdatedAt;
    } else if (input.avatar?.source === 'upload') {
      decodeUploadedAvatar(input.avatar.dataUrl);
      next.avatar = { source: 'upload', dataUrl: input.avatar.dataUrl };
      next.avatarUpdatedAt = now;
    } else if (input.avatar?.source === 'google') {
      next.avatar = { source: 'google', url: normalizeGooglePicture(user.picture) };
      next.avatarUpdatedAt = now;
    } else {
      throw new PlayerProfileValidationError('Choose an uploaded or Google avatar');
    }
  }

  return next;
}

/** The only profile fields safe to attach to public leaderboard rows. */
export function toPublicPlayerProfile(profile) {
  if (!profile?.userId) return null;
  return {
    userId: profile.userId,
    ...(typeof profile.country === 'string' && profile.country ? { country: profile.country } : {}),
    ...(profile.avatar && typeof profile.avatarUpdatedAt === 'string'
      ? { avatarVersion: profile.avatarUpdatedAt }
      : {}),
  };
}
