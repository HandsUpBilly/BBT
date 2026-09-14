// Promotion and demotion of an administrator from the Statistics login table.
//
// This lives here because the Express and Netlify handlers were previously
// hand-copies of each other: the same five branches written out twice, one of
// which decides who holds administrator access. `shared/` exists precisely so
// that pair cannot drift.
//
// The handlers keep only what genuinely differs between the targets — reading
// the request, authenticating it, and persisting the result. Everything that
// decides *what* should happen is here.

import { addManagedAdmin, removeManagedAdmin } from './adminManagement.js';
import { loginAdminEmail } from './loginTracking.js';

/**
 * Decides the outcome of a POST (promote) or DELETE (demote) against the
 * managed-admin list.
 *
 * The browser only ever supplies the opaque login id; the private Google
 * address is resolved here from the stored login record and returned for the
 * audit entry, never for the response body.
 *
 * @param options.entries              stored login records
 * @param options.userId               opaque login id from the query string
 * @param options.adding               true to promote, false to demote
 * @param options.current              current managed-admin list
 * @param options.configuredAdminCount size of the deployment allowlist
 *   (`ADMIN_EMAILS` unioned with the permanent owner)
 * @returns `{ ok: true, target, managedAdmins }`, or
 *   `{ ok: false, status, errors }` describing the refusal
 */
export function planLoginAdminUpdate({ entries, userId, adding, current, configuredAdminCount }) {
  // Express query values can arrive as an array or object (`?userId[]=x`), so
  // anything but a plain string is refused rather than coerced into a match.
  const target = loginAdminEmail(entries, typeof userId === 'string' ? userId : '');
  if (!target) {
    return { ok: false, status: 400, errors: ['This login is not a verified Google account.'] };
  }

  const managedAdmins = adding ? addManagedAdmin(current, target) : removeManagedAdmin(current, target);

  // Only reachable where nothing is configured — an unauthenticated local
  // environment. A real deployment always carries the permanent owner, so
  // demoting the last managed admin there still leaves an administrator.
  if (!adding && configuredAdminCount === 0 && managedAdmins.length === 0 && current.length > 0) {
    return {
      ok: false,
      status: 400,
      errors: ['Keep at least one managed administrator, or configure ADMIN_EMAILS.'],
    };
  }

  // Nothing came off the list: the address is in ADMIN_EMAILS or is the
  // permanent owner, neither of which this endpoint can revoke.
  if (!adding && managedAdmins.length === current.length) {
    return {
      ok: false,
      status: 404,
      errors: ['That administrator is managed by deployment configuration or does not exist.'],
    };
  }

  return { ok: true, target, managedAdmins };
}
