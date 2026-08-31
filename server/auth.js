// Express-side binding of the shared Google auth helpers.
// All the actual logic lives in shared/googleAuth.js so this file and
// netlify/functions/auth.js can never drift apart.

// google-auth-library is imported HERE, not in shared/, because module
// resolution walks up from the importing file — and shared/ is not an ancestor
// of server/node_modules. See the note at the top of shared/googleAuth.js.
import { OAuth2Client } from 'google-auth-library';
import {
  createGoogleAuth,
  makeGoogleTokenVerifier,
  AuthError,
  AdminAuthError,
  entryAuthFields,
  withPermanentAdminEmails,
} from '../shared/googleAuth.js';
import { readManagedAdmins } from './adminStore.js';

export { AuthError, AdminAuthError, entryAuthFields };

// The permanent owner is included wherever Google verification is configured.
// EDITOR_ALLOW_UNAUTHENTICATED=false also makes an otherwise-empty effective
// list fail closed. A non-empty list always requires a matching Google user.
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const auth = createGoogleAuth({
  verifyIdToken: makeGoogleTokenVerifier(OAuth2Client, googleClientId),
  // Keep unauthenticated local development usable when Google sign-in is not
  // configured. In any environment that can verify Google identity, the
  // project owner's address is an immutable member of the allowlist.
  adminEmails: googleClientId
    ? withPermanentAdminEmails(process.env.ADMIN_EMAILS)
    : process.env.ADMIN_EMAILS,
  allowUnauthenticated: process.env.EDITOR_ALLOW_UNAUTHENTICATED !== 'false',
  getManagedAdminEmails: readManagedAdmins,
});

const headerReader = req => name => req.get(name) ?? null;

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
