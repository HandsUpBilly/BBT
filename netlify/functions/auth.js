import { OAuth2Client } from 'google-auth-library';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

export class AuthError extends Error {}

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
  return new Response(JSON.stringify({ error: error.message }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}
