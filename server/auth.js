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
} from '../shared/googleAuth.js';
import { readManagedAdmins } from './adminStore.js';

export { AuthError, AdminAuthError, entryAuthFields };

// With no allowlist configured, Admin Mode is intentionally unrestricted.
// Set EDITOR_ALLOW_UNAUTHENTICATED=false to make an empty ADMIN_EMAILS fail
// closed instead. A non-empty allowlist always requires a matching Google user.
const auth = createGoogleAuth({
  verifyIdToken: makeGoogleTokenVerifier(OAuth2Client, process.env.GOOGLE_CLIENT_ID),
  adminEmails: process.env.ADMIN_EMAILS,
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

export function isAdminUser(user) {
  return auth.isAdminUser(user);
}
