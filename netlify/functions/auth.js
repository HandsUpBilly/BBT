// Netlify-side binding of the shared Google auth helpers.
// Logic lives in shared/googleAuth.js — see server/auth.js for the Express
// equivalent. The only intentional difference is the fail-closed default below.

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

export { AuthError, AdminAuthError, entryAuthFields };

// Production fails CLOSED. If ADMIN_EMAILS is missing or mistyped the editor
// endpoints return 503 rather than accepting anonymous writes — a forgotten env
// var must never turn the deployed site into a world-writable puzzle editor.
// Setting EDITOR_ALLOW_UNAUTHENTICATED=true re-opens it, which is only ever
// appropriate for a throwaway preview deploy.
const auth = createGoogleAuth({
  verifyIdToken: makeGoogleTokenVerifier(OAuth2Client, process.env.GOOGLE_CLIENT_ID),
  adminEmails: process.env.ADMIN_EMAILS,
  allowUnauthenticated: process.env.EDITOR_ALLOW_UNAUTHENTICATED === 'true',
});

const headerReader = req => name => req.headers.get(name);

export function verifyOptionalGoogleUser(req) {
  return auth.verifyOptionalGoogleUser(headerReader(req));
}

export function requireAdminGoogleUser(req) {
  return auth.requireAdminGoogleUser(headerReader(req));
}

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
