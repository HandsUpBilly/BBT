import { addManagedAdmin, removeManagedAdmin } from '../../shared/adminManagement.js';
import { readManagedAdmins, saveManagedAdminsWithAudit } from './adminStore.js';
import { AdminAuthError, authErrorResponse, configuredAdminCount, requireAdminGoogleUser, requireVerifiedGoogleIdentity } from './auth.js';
import { leaderboardStore, readEntries } from './blobEntries.js';
import { adminLoginEntries, loginAdminEmail } from '../../shared/loginTracking.js';

const KEY = 'logins';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(req) {
  let user;
  try {
    const admin = await requireAdminGoogleUser(req);
    user = admin ?? (req.method === 'GET' ? null : await requireVerifiedGoogleIdentity(req));
  } catch (error) {
    if (error instanceof AdminAuthError) return authErrorResponse(error);
    throw error;
  }

  const store = leaderboardStore('player-logins');
  const { entries } = await readEntries(store, KEY);
  if (req.method === 'GET') return jsonResponse(200, adminLoginEntries(entries, await readManagedAdmins()));
  if (req.method !== 'POST' && req.method !== 'DELETE') return jsonResponse(405, { errors: ['Method not allowed'] });

  const target = loginAdminEmail(entries, new URL(req.url).searchParams.get('userId') ?? '');
  if (!target) return jsonResponse(400, { errors: ['This login is not a verified Google account.'] });

  try {
    const current = await readManagedAdmins();
    const adding = req.method === 'POST';
    const managedAdmins = adding ? addManagedAdmin(current, target) : removeManagedAdmin(current, target);
    if (!adding && configuredAdminCount === 0 && managedAdmins.length === 0 && current.length > 0) {
      return jsonResponse(400, { errors: ['Keep at least one managed administrator, or configure ADMIN_EMAILS.'] });
    }
    if (!adding && managedAdmins.length === current.length) {
      return jsonResponse(404, { errors: ['That administrator is managed by deployment configuration or does not exist.'] });
    }
    const saved = await saveManagedAdminsWithAudit(managedAdmins, {
      action: adding ? 'added' : 'removed', actor: user.email, target,
    });
    return jsonResponse(200, { ...saved, configuredAdminCount });
  } catch (error) {
    return jsonResponse(400, { errors: [error instanceof Error ? error.message : 'Could not update administrator'] });
  }
}
