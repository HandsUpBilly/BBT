import { OAuth2Client } from 'google-auth-library';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean),
);

export class AuthError extends Error {}
export class AdminAuthError extends AuthError {
  constructor(message, status = 403) {
    super(message);
    this.status = status;
  }
}

function bearerToken(req) {
  const header = req.headers.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export async function verifyOptionalGoogleUser(req) {
  const token = bearerToken(req);
  if (!token) return null;
  if (!GOOGLE_CLIENT_ID) throw new AuthError('Google sign-in is not configured');

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub) throw new Error('Missing Google subject');
    return {
      provider: 'google',
      providerUserId: payload.sub,
      name: payload.name,
      email: payload.email,
      picture: payload.picture,
    };
  } catch {
    throw new AuthError('Invalid Google identity token');
  }
}

export function isAdminUser(user) {
  return Boolean(user?.email && ADMIN_EMAILS.has(user.email.toLowerCase()));
}

/** Verifies the request carries a Google identity token belonging to an allowlisted
 * admin email. Throws AdminAuthError (a subclass of AuthError) if not signed in or
 * not an admin, so callers can share the same 401/403 handling as verifyOptionalGoogleUser.
 * See server/auth.js requireAdminGoogleUser for the ADMIN_EMAILS-unset fallback rationale. */
export async function requireAdminGoogleUser(req) {
  if (ADMIN_EMAILS.size === 0) return null;
  const user = await verifyOptionalGoogleUser(req);
  if (!user) throw new AdminAuthError('Sign-in required', 401);
  if (!isAdminUser(user)) throw new AdminAuthError('Admin access required', 403);
  return user;
}

export function entryAuthFields(user) {
  if (!user) return {};
  return {
    userId: user.providerUserId,
    authProvider: user.provider,
    displayName: user.name,
    avatarUrl: user.picture,
  };
}

export function authErrorResponse(error) {
  const status = error instanceof AdminAuthError ? error.status : 401;
  return new Response(JSON.stringify({ error: error.message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
