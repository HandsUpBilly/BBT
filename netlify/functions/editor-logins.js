import { planLoginAdminUpdate } from '../../shared/loginAdminControl.js';
import { readManagedAdmins, saveManagedAdminsWithAudit } from './adminStore.js';
import { AdminAuthError, authErrorResponse, configuredAdminCount, requireAdminGoogleUser, requireVerifiedGoogleIdentity } from './auth.js';
import { leaderboardStore, readEntries } from './blobEntries.js';
import { adminLoginEntries } from '../../shared/loginTracking.js';

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

  const adding = req.method === 'POST';
  try {
    const plan = planLoginAdminUpdate({
      entries,
      userId: new URL(req.url).searchParams.get('userId'),
      adding,
      current: await readManagedAdmins(),
      configuredAdminCount,
    });
    if (!plan.ok) return jsonResponse(plan.status, { errors: plan.errors });

    const saved = await saveManagedAdminsWithAudit(plan.managedAdmins, {
      action: adding ? 'added' : 'removed', actor: user.email, target: plan.target,
    });
    return jsonResponse(200, { ...saved, configuredAdminCount });
  } catch (error) {
    return jsonResponse(400, { errors: [error instanceof Error ? error.message : 'Could not update administrator'] });
  }
}
