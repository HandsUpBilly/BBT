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
  withPermanentAdminEmails,
} from '../../shared/googleAuth.js';
import { readManagedAdmins } from './adminStore.js';

export { AuthError, AdminAuthError, entryAuthFields };

// The permanent owner is included wherever Google verification is configured.
// EDITOR_ALLOW_UNAUTHENTICATED=false also makes an otherwise-empty effective
// list fail closed. A non-empty list requires a verified matching account.
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const auth = createGoogleAuth({
  verifyIdToken: makeGoogleTokenVerifier(OAuth2Client, googleClientId),
  adminEmails: googleClientId
    ? withPermanentAdminEmails(process.env.ADMIN_EMAILS)
    : process.env.ADMIN_EMAILS,
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

export function authErrorResponse(error) {
  const status = error instanceof AdminAuthError ? error.status : 401;
  return new Response(JSON.stringify({ error: error.message, errors: [error.message] }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
