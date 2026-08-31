// Shared Google identity verification for both deployment targets.
//
// Express (server/) and Netlify Functions expose headers differently, so
// callers pass a `getHeader(name) => string | null` adapter rather than the
// request object itself. Everything else — token verification, the admin
// allowlist, and the entry metadata shape — lives here so the two targets can
// never disagree about who is allowed to write.
//
// This module deliberately imports NOTHING. `google-auth-library` is injected
// by the caller via makeGoogleTokenVerifier: esbuild resolves bare imports
// relative to the importing file, and shared/ is not an ancestor of either
// target's node_modules, so importing it here fails the Netlify functions
// bundle. Keeping shared/ dependency-free also makes it safe for the browser
// bundle to pull from the same directory.

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

// The project owner must retain access even if deployment configuration or the
// runtime-managed list is changed. This is still protected by Google's token
// verification: knowing the address does not grant access without a verified
// identity token for that account.
export const PERMANENT_ADMIN_EMAILS = Object.freeze([
  'oliver.whitehead@gmail.com',
]);

export function withPermanentAdminEmails(raw) {
  return [...new Set([
    ...parseAdminEmails(raw),
    ...PERMANENT_ADMIN_EMAILS,
  ])].join(',');
}

export function bearerToken(getHeader) {
  const header = getHeader('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

/**
 * Builds the token verifier each target passes into createGoogleAuth.
 *
 * The OAuth2Client *class* is a parameter rather than an import so this module
 * stays dependency-free — see the note at the top of the file. The audience
 * check and payload extraction still live here, so both targets verify tokens
 * identically.
 *
 * @param OAuth2Client  the class from google-auth-library
 * @param clientId      GOOGLE_CLIENT_ID; null/undefined disables sign-in
 * @returns `(idToken) => payload`, or null when no client id is configured
 */
export function makeGoogleTokenVerifier(OAuth2Client, clientId) {
  if (!clientId) return null;
  const client = new OAuth2Client(clientId);
  return async idToken => {
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    return ticket.getPayload();
  };
}

/**
 * Creates the auth helpers bound to one environment's configuration.
 *
 * @param options.verifyIdToken         from makeGoogleTokenVerifier; null when
 *   Google sign-in is not configured for this environment
 * @param options.adminEmails           raw comma-separated ADMIN_EMAILS string
 * @param options.allowUnauthenticated  when no allowlist is configured, permit
 *   unauthenticated editor access. This defaults to true so an unset
 *   ADMIN_EMAILS means no restriction; deployments can explicitly pass false
 *   to fail closed instead.
 */
export function createGoogleAuth({ verifyIdToken, adminEmails, allowUnauthenticated = true, getManagedAdminEmails }) {
  const allowlist = parseAdminEmails(adminEmails);

  // Visible at cold start so an accidentally-cleared/typo'd ADMIN_EMAILS in
  // production isn't a silent, indefinite fail-open — there is no other
  // log line or health check that would reveal it.
  if (allowlist.size === 0 && allowUnauthenticated) {
    console.warn(
      '[auth] ADMIN_EMAILS is empty. Every /api/editor/* route is unrestricted. ' +
      'Set EDITOR_ALLOW_UNAUTHENTICATED=false to fail closed instead.',
    );
  }

  /** Verifies the Bearer token if one is present. Returns null for guests. */
  async function verifyOptionalGoogleUser(getHeader) {
    const token = bearerToken(getHeader);
    if (!token) return null;
    if (!verifyIdToken) throw new AuthError('Google sign-in is not configured');

    let payload;
    try {
      payload = await verifyIdToken(token);
    } catch {
      throw new AuthError('Invalid Google identity token');
    }

    if (!payload?.sub) throw new AuthError('Invalid Google identity token');

    return {
      provider: 'google',
      providerUserId: payload.sub,
      // Only trust the address Google says it has verified — the admin
      // allowlist is matched against this.
      email: payload.email_verified ? payload.email : undefined,
      // Used only when the player explicitly chooses their Google photo for
      // the public profile. It is never copied into leaderboard entries.
      picture: typeof payload.picture === 'string' ? payload.picture : undefined,
    };
  }

  async function effectiveAllowlist() {
    if (!getManagedAdminEmails) return allowlist;
    try {
      const managed = parseAdminEmails((await getManagedAdminEmails()).join(','));
      return new Set([...allowlist, ...managed]);
    } catch {
      throw new AdminAuthError('Administrator access could not be checked', 503);
    }
  }

  async function requireVerifiedGoogleUser(getHeader) {
    const user = await verifyOptionalGoogleUser(getHeader);
    if (!user) throw new AdminAuthError('Sign-in required', 401);
    if (!user.email) throw new AdminAuthError('A verified email address is required', 403);
    return user;
  }

  /**
   * Requires a verified Google identity on the admin allowlist.
   *
   * When no allowlist is configured, access is unrestricted unless the caller
   * explicitly disables allowUnauthenticated. With an allowlist, throws
   * AdminAuthError (401 not signed in, 403 not allowlisted) as appropriate.
   */
  async function requireAdminGoogleUser(getHeader) {
    const activeAllowlist = await effectiveAllowlist();
    if (activeAllowlist.size === 0) {
      if (allowUnauthenticated) return null;
      throw new AdminAuthError('Editor access is not configured on this deployment', 503);
    }
    const user = await requireVerifiedGoogleUser(getHeader);
    if (!activeAllowlist.has(user.email.toLowerCase())) throw new AdminAuthError('Admin access required', 403);
    return user;
  }

  return {
    verifyOptionalGoogleUser,
    requireAdminGoogleUser,
    requireVerifiedGoogleUser,
    adminEmailCount: allowlist.size,
  };
}

/** Verified account fields used to associate a signed-in player's best scores. */
export function entryAuthFields(user) {
  if (!user) return {};
  return {
    userId: user.providerUserId,
    authProvider: user.provider,
  };
}
