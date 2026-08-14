/**
 * Per-account display preferences: player token style and avatar image.
 *
 * Mirrors the `bbt.googleAliases.v1` shape in App.tsx — one JSON object keyed
 * by identity, so a shared device can hold prefs for more than one signed-in
 * player without clobbering each other. Guests get the fixed key `'guest'`
 * rather than being keyed by name: unlike a Google subject id, a guest's name
 * is also the thing they can change on this same screen, so keying by it would
 * strand every existing preference the moment they renamed themselves.
 *
 * The avatar here is local-only (Phase 1): a data URL, visible on this device
 * to this player, not uploaded anywhere. It is not shown on leaderboards,
 * which is a different, server-side feature — see spec.md "Player Config
 * Screen".
 *
 * Every read tolerates junk, matching attemptStore.ts: this is user-writable
 * storage that survives deploys, so an unrecognized shape must degrade to
 * "no preference" rather than break the screen it is on.
 */

import { AVATAR_MAX_DATA_URL_LENGTH } from './avatarImage';

export const GUEST_PREFS_KEY = 'guest';

const STORAGE_KEY = 'bbt.prefs.v1';

export type TokenStyle = 'portrait' | 'simple' | 'plain';
export type PitchSurface = 'grass' | 'slate';

export interface PlayerPrefs {
  tokenStyle?: TokenStyle;
  pitchSurface?: PitchSurface;
  showCoordinates?: boolean;
  /** A `data:image/webp;base64,...` URL produced by avatarImage.ts. */
  avatar?: string;
  /**
   * Opt in to the board-state branching model for block dice (spec.md, "Block
   * Outcomes as Board-State Branches"). Off means the shipped outcome
   * checklist. This is a build-in-progress flag, not a taste setting: the two
   * models score differently, so a run made under one is not comparable to a
   * run made under the other.
   */
  blockBranching?: boolean;
}

type PrefsMap = Record<string, PlayerPrefs>;

function isTokenStyle(value: unknown): value is TokenStyle {
  return value === 'portrait' || value === 'simple' || value === 'plain';
}

function isPitchSurface(value: unknown): value is PitchSurface {
  return value === 'grass' || value === 'slate';
}

function isAvatarDataUrl(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= AVATAR_MAX_DATA_URL_LENGTH
    && value.startsWith('data:image/');
}

function sanitizePrefs(value: unknown): PlayerPrefs | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<PlayerPrefs>;
  const prefs: PlayerPrefs = {};
  if (isTokenStyle(candidate.tokenStyle)) prefs.tokenStyle = candidate.tokenStyle;
  if (isPitchSurface(candidate.pitchSurface)) prefs.pitchSurface = candidate.pitchSurface;
  if (typeof candidate.showCoordinates === 'boolean') prefs.showCoordinates = candidate.showCoordinates;
  if (typeof candidate.blockBranching === 'boolean') prefs.blockBranching = candidate.blockBranching;
  if (isAvatarDataUrl(candidate.avatar)) prefs.avatar = candidate.avatar;
  return prefs;
}

function readAll(): PrefsMap {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const clean: PrefsMap = {};
    for (const [identityKey, value] of Object.entries(parsed)) {
      const sanitized = sanitizePrefs(value);
      if (sanitized && Object.keys(sanitized).length > 0) clean[identityKey] = sanitized;
    }
    return clean;
  } catch {
    return {};
  }
}

export function readAllPrefs(): PrefsMap {
  return readAll();
}

export function readPrefs(identityKey: string): PlayerPrefs {
  return readAll()[identityKey] ?? {};
}

/**
 * Merges `patch` into the identity's stored prefs. Setting a field to
 * `undefined` clears it (e.g. removing an avatar), since `JSON.stringify`
 * drops `undefined` values on write.
 *
 * A failed write is not worth surfacing — the same posture as attemptStore.ts
 * and the existing alias writers — the in-memory value the caller already has
 * is correct; only persistence across a reload is at risk.
 */
export function writePrefs(identityKey: string, patch: Partial<PlayerPrefs>): void {
  try {
    const all = readAll();
    all[identityKey] = { ...all[identityKey], ...patch };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Storage unavailable (private browsing, quota) — the preference just
    // won't persist across a reload.
  }
}
