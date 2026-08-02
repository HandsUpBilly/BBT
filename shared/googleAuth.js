// Shared Google identity verification for both deployment targets.
//
// Express (server/) and Netlify Functions expose headers differently, so
// callers pass a `getHeader(name) => string | null` adapter rather than the
// request object itself. Everything else — token verification, the admin
// allowlist, and the entry metadata shape — lives here so the two targets can
// never disagree about who is allowed to write.

import { OAuth2Client } from 'google-auth-library';

export class AuthError extends Error {}

export class AdminAuthError extends AuthError {
  constructor(message, status = 403) {
    super(message);
    this.status = status;
  }
}

export function parseAdminEmails(raw) {
  return new Set(
    (raw ?? '')
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function bearerToken(getHeader) {
  const header = getHeader('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

/**
 * Creates the auth helpers bound to one environment's configuration.
 *
 * @param options.clientId              GOOGLE_CLIENT_ID
 * @param options.adminEmails           raw comma-separated ADMIN_EMAILS string
 * @param options.allowUnauthenticated  when no allowlist is configured, permit
 *   unauthenticated editor writes. Local dev opts in so the editor works
 *   without any OAuth setup; production must NOT, otherwise a missing env var
 *   silently opens the editor to the public internet.
 */
export function createGoogleAuth({ clientId, adminEmails, allowUnauthenticated = false }) {
  const client = new OAuth2Client(clientId);
  const allowlist = parseAdminEmails(adminEmails);

  /** Verifies the Bearer token if one is present. Returns null for guests. */
  async function verifyOptionalGoogleUser(getHeader) {
    const token = bearerToken(getHeader);
    if (!token) return null;
    if (!clientId) throw new AuthError('Google sign-in is not configured');

    let payload;
    try {
      const ticket = await client.verifyIdToken({ idToken: token, audience: clientId });
      payload = ticket.getPayload();
    } catch {
      throw new AuthError('Invalid Google identity token');
    }

    if (!payload?.sub) throw new AuthError('Invalid Google identity token');

    return {
      provider: 'google',
      providerUserId: payload.sub,
      name: payload.name,
      // Only trust the address Google says it has verified — the admin
      // allowlist is matched against this.
      email: payload.email_verified ? payload.email : undefined,
      picture: payload.picture,
    };
  }

  function isAdminUser(user) {
    return Boolean(user?.email && allowlist.has(user.email.toLowerCase()));
  }

  /**
   * Requires a verified Google identity on the admin allowlist.
   *
   * Throws AdminAuthError (401 not signed in, 403 not allowlisted, 503 not
   * configured) — a subclass of AuthError, so callers share one error branch.
   * Guest sessions carry no ID token and can never pass.
   */
  async function requireAdminGoogleUser(getHeader) {
    if (allowlist.size === 0) {
      if (allowUnauthenticated) return null;
      throw new AdminAuthError('Editor access is not configured on this deployment', 503);
    }
    const user = await verifyOptionalGoogleUser(getHeader);
    if (!user) throw new AdminAuthError('Sign-in required', 401);
    if (!isAdminUser(user)) throw new AdminAuthError('Admin access required', 403);
    return user;
  }

  return {
    verifyOptionalGoogleUser,
    isAdminUser,
    requireAdminGoogleUser,
    adminEmailCount: allowlist.size,
  };
}

/** Verified identity fields copied onto a leaderboard entry. */
export function entryAuthFields(user) {
  if (!user) return {};
  return {
    userId: user.providerUserId,
    authProvider: user.provider,
    displayName: user.name,
    avatarUrl: user.picture,
  };
}
