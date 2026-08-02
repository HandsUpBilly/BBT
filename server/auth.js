// Express-side binding of the shared Google auth helpers.
// All the actual logic lives in shared/googleAuth.js so this file and
// netlify/functions/auth.js can never drift apart.

import { createGoogleAuth, AuthError, AdminAuthError, entryAuthFields } from '../shared/googleAuth.js';

export { AuthError, AdminAuthError, entryAuthFields };

// Local dev intentionally allows editor writes with no allowlist configured, so
// the puzzle editor works without any Google OAuth setup. Set
// EDITOR_ALLOW_UNAUTHENTICATED=false to exercise the production behavior
// locally. The Netlify build does NOT get this default — see
// netlify/functions/auth.js.
const auth = createGoogleAuth({
  clientId: process.env.GOOGLE_CLIENT_ID,
  adminEmails: process.env.ADMIN_EMAILS,
  allowUnauthenticated: process.env.EDITOR_ALLOW_UNAUTHENTICATED !== 'false',
});

const headerReader = req => name => req.get(name) ?? null;

export function verifyOptionalGoogleUser(req) {
  return auth.verifyOptionalGoogleUser(headerReader(req));
}

export function requireAdminGoogleUser(req) {
  return auth.requireAdminGoogleUser(headerReader(req));
}

export function isAdminUser(user) {
  return auth.isAdminUser(user);
}
