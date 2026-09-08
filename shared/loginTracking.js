// Per-player login history: unlike shared/statistics.js (deliberately
// anonymous puzzle-performance aggregates), this DOES record each player's
// handle — it exists specifically to answer "who has played this, and how
// often" for the admin Statistics screen.

import { normalizeAdminEmail } from './adminManagement.js';

export const LOGIN_LIMITS = { name: 32 };

export class LoginValidationError extends Error {}

/** Same trim/length rule as a leaderboard name, so a login's stored handle
 * always matches what that player sees next to their own scores. */
export function validateLoginPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new LoginValidationError('Invalid login payload');
  }
  const name = String(body.name ?? '').trim().slice(0, LOGIN_LIMITS.name);
  if (!name) throw new LoginValidationError('name is required');
  return { name };
}

/**
 * Upserts one login record — matched by Google account (providerUserId) for
 * signed-in players, or by handle for guests, same convention as
 * upsertPersonalBest in scoreValidation.js. A guest who reuses another
 * guest's handle is indistinguishable from them, same limitation the
 * leaderboards already have.
 *
 * Returns the full entry list to persist, plus the entry as it stands after
 * this login (first login: created with count 1; a later login: handle
 * refreshed to whatever they're using now, count incremented).
 */
export function recordLogin(entries, { name, user }, now = new Date().toISOString()) {
  const matches = user
    ? existing => existing.userId === user.providerUserId
    : existing => !existing.userId && existing.name === name;

  const index = entries.findIndex(matches);
  if (index < 0) {
    // The address is retained only for a verified Google identity so an
    // administrator can grant access from the login list. It is never part of
    // the editor response; see adminLoginEntries below.
    const adminEmail = user?.provider === 'google' ? normalizeAdminEmail(user.email) : null;
    const entry = {
      name,
      firstLoginAt: now,
      lastLoginAt: now,
      loginCount: 1,
      ...(user ? { userId: user.providerUserId, authProvider: user.provider } : {}),
      ...(adminEmail ? { adminEmail } : {}),
    };
    return { entries: [...entries, entry], entry };
  }

  const existing = entries[index];
  const adminEmail = user?.provider === 'google' ? normalizeAdminEmail(user.email) : null;
  const entry = {
    ...existing,
    name,
    lastLoginAt: now,
    loginCount: existing.loginCount + 1,
    ...(adminEmail ? { adminEmail } : {}),
  };
  const next = [...entries];
  next[index] = entry;
  return { entries: next, entry };
}

/** Most recently active player first. */
export function sortLogins(entries) {
  return [...entries].sort((a, b) => b.lastLoginAt.localeCompare(a.lastLoginAt));
}

/** Finds the private, verified Google address attached to a login record. */
export function loginAdminEmail(entries, userId) {
  const entry = entries.find(item => item.userId === userId);
  if (!entry || entry.authProvider !== 'google') return null;
  return normalizeAdminEmail(entry.adminEmail);
}

/**
 * Safe editor projection: deliberately redacts the stored email while
 * exposing enough state for the administrator to grant or revoke access.
 */
export function adminLoginEntries(entries, managedAdmins = []) {
  const adminEmails = new Set(managedAdmins.map(normalizeAdminEmail).filter(Boolean));
  return sortLogins(entries).map(({ adminEmail, ...entry }) => {
    const email = entry.authProvider === 'google' ? normalizeAdminEmail(adminEmail) : null;
    return {
      ...entry,
      adminEligible: Boolean(email),
      isManagedAdmin: Boolean(email && adminEmails.has(email)),
    };
  });
}
