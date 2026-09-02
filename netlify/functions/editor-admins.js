import { addManagedAdmin, normalizeAdminEmail, removeManagedAdmin } from '../../shared/adminManagement.js';
import { readAdminAudit, readManagedAdmins, saveManagedAdminsWithAudit } from './adminStore.js';
import { AdminAuthError, authErrorResponse, configuredAdminCount, requireAdminGoogleUser, requireVerifiedGoogleIdentity } from './auth.js';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function requireManager(req) {
  const admin = await requireAdminGoogleUser(req);
  return admin ?? requireVerifiedGoogleIdentity(req);
}

function emailFromRequest(url) {
  const value = url.searchParams.get('email');
  return value ?? '';
}

export default async function handler(req) {
  let user;
  try {
    user = await requireManager(req);
  } catch (error) {
    if (error instanceof AdminAuthError) return authErrorResponse(error);
    throw error;
  }

  if (req.method === 'GET') {
    return jsonResponse(200, { managedAdmins: await readManagedAdmins(), configuredAdminCount, audit: await readAdminAudit() });
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const target = normalizeAdminEmail(body?.email);
      const saved = await saveManagedAdminsWithAudit(addManagedAdmin(await readManagedAdmins(), target), { action: 'added', actor: user.email, target });
      return jsonResponse(200, { ...saved, configuredAdminCount });
    } catch (error) {
      return jsonResponse(400, { errors: [error instanceof Error ? error.message : 'Could not add administrator'] });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const current = await readManagedAdmins();
      const managedAdmins = removeManagedAdmin(current, emailFromRequest(new URL(req.url)));
      if (configuredAdminCount === 0 && managedAdmins.length === 0 && current.length > 0) {
        return jsonResponse(400, { errors: ['Keep at least one managed administrator, or configure ADMIN_EMAILS.'] });
      }
      if (managedAdmins.length === current.length) {
        return jsonResponse(404, { errors: ['That administrator is managed by deployment configuration or does not exist.'] });
      }
      const target = normalizeAdminEmail(emailFromRequest(new URL(req.url)));
      const saved = await saveManagedAdminsWithAudit(managedAdmins, { action: 'removed', actor: user.email, target });
      return jsonResponse(200, { ...saved, configuredAdminCount });
    } catch (error) {
      return jsonResponse(400, { errors: [error instanceof Error ? error.message : 'Could not remove administrator'] });
    }
  }

  return jsonResponse(405, { errors: ['Method not allowed'] });
}
