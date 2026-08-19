import { getStore } from '@netlify/blobs';
import { normalizeManagedAdmins } from '../../shared/adminManagement.js';

const MANAGED_ADMINS_KEY = 'managed-admins';

function normalizeAudit(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(entry => entry && typeof entry === 'object'
    && (entry.action === 'added' || entry.action === 'removed')
    && typeof entry.actor === 'string' && typeof entry.target === 'string'
    && typeof entry.at === 'string').slice(0, 100);
}

function store() {
  return getStore({
    name: 'admin-access',
    siteID: process.env.NETLIFY_SITE_ID ?? process.env.SITE_ID,
    token: process.env.NETLIFY_TOKEN ?? process.env.NETLIFY_AUTH_TOKEN,
  });
}

async function readAccess() {
  const raw = await store().get(MANAGED_ADMINS_KEY, { type: 'text' });
  if (!raw) return { emails: [], audit: [] };
  try {
    const parsed = JSON.parse(raw);
    return { emails: normalizeManagedAdmins(parsed), audit: normalizeAudit(parsed?.audit) };
  } catch {
    // Corruption is not equivalent to an empty first-run store. Let the auth
    // layer turn this into a 503 so a damaged store cannot fail open.
    throw new Error('Managed administrator store is unreadable');
  }
}

export async function readManagedAdmins() { return (await readAccess()).emails; }
export async function readAdminAudit() { return (await readAccess()).audit; }

export async function writeManagedAdmins(emails) {
  const normalized = normalizeManagedAdmins(emails);
  const { audit } = await readAccess();
  await store().set(MANAGED_ADMINS_KEY, JSON.stringify({ emails: normalized, audit }));
  return normalized;
}

export async function recordAdminAudit(entry) {
  const { emails, audit } = await readAccess();
  const nextAudit = [{ action: entry.action, actor: entry.actor, target: entry.target, at: new Date().toISOString() }, ...audit].slice(0, 100);
  await store().set(MANAGED_ADMINS_KEY, JSON.stringify({ emails, audit: nextAudit }));
  return nextAudit;
}

export async function saveManagedAdminsWithAudit(emails, entry) {
  const normalized = normalizeManagedAdmins(emails);
  const { audit } = await readAccess();
  const nextAudit = [{ action: entry.action, actor: entry.actor, target: entry.target, at: new Date().toISOString() }, ...audit].slice(0, 100);
  await store().set(MANAGED_ADMINS_KEY, JSON.stringify({ emails: normalized, audit: nextAudit }));
  return { managedAdmins: normalized, audit: nextAudit };
}
