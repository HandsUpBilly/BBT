// Netlify-side binding of the shared Google auth helpers.
// Logic lives in shared/googleAuth.js — see server/auth.js for the Express
// equivalent. Keep their empty-allowlist defaults aligned.

// google-auth-library is imported HERE, not in shared/. esbuild resolves bare
// imports relative to the importing file, and shared/ is not an ancestor of
// netlify/functions/node_modules — importing it from shared/ fails the
// functions bundle with "Could not resolve google-auth-library".
import { OAuth2Client } from 'google-auth-library';
import {
  createGoogleAuth,
  makeGoogleTokenVerifier,
  AuthError,
  AdminAuthError,
  entryAuthFields,
} from '../../shared/googleAuth.js';
import { readManagedAdmins } from './adminStore.js';

export { AuthError, AdminAuthError, entryAuthFields };

// An empty ADMIN_EMAILS means Admin Mode is unrestricted. Set
// EDITOR_ALLOW_UNAUTHENTICATED=false to opt into fail-closed behavior instead.
// A non-empty allowlist always requires a verified, matching Google account.
const auth = createGoogleAuth({
  verifyIdToken: makeGoogleTokenVerifier(OAuth2Client, process.env.GOOGLE_CLIENT_ID),
  adminEmails: process.env.ADMIN_EMAILS,
  allowUnauthenticated: process.env.EDITOR_ALLOW_UNAUTHENTICATED !== 'false',
  getManagedAdminEmails: readManagedAdmins,
});

const headerReader = req => name => req.headers.get(name);

export function verifyOptionalGoogleUser(req) {
  return auth.verifyOptionalGoogleUser(headerReader(req));
}

export function requireAdminGoogleUser(req) {
  return auth.requireAdminGoogleUser(headerReader(req));
}

export function requireVerifiedGoogleUser(req) {
  return auth.requireVerifiedGoogleUser(headerReader(req));
}

export const configuredAdminCount = auth.adminEmailCount;

export function isAdminUser(user) {
  return auth.isAdminUser(user);
}

export function authErrorResponse(error) {
  const status = error instanceof AdminAuthError ? error.status : 401;
  return new Response(JSON.stringify({ error: error.message, errors: [error.message] }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
