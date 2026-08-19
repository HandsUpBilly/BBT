import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { normalizeManagedAdmins } from '../shared/adminManagement.js';

const ADMIN_STORE_PATH = join(process.cwd(), '..', '.bbt-managed-admins.json');

function normalizeAudit(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(entry => entry && typeof entry === 'object'
    && (entry.action === 'added' || entry.action === 'removed')
    && typeof entry.actor === 'string' && typeof entry.target === 'string'
    && typeof entry.at === 'string')
    .slice(0, 100);
}

async function readAccess() {
  try {
    const parsed = JSON.parse(await readFile(ADMIN_STORE_PATH, 'utf8'));
    return { emails: normalizeManagedAdmins(parsed), audit: normalizeAudit(parsed?.audit) };
  } catch (error) {
    // A missing local runtime store is the normal first-run state. Any other
    // I/O error or corrupt JSON must reach auth so it fails closed instead of
    // accidentally treating an unavailable managed allowlist as an empty one.
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return { emails: [], audit: [] };
    }
    throw error;
  }
}

export async function readManagedAdmins() {
  return (await readAccess()).emails;
}

export async function readAdminAudit() { return (await readAccess()).audit; }

export async function writeManagedAdmins(emails) {
  const normalized = normalizeManagedAdmins(emails);
  const { audit } = await readAccess();
  await writeFile(ADMIN_STORE_PATH, `${JSON.stringify({ emails: normalized, audit }, null, 2)}\n`);
  return normalized;
}

export async function recordAdminAudit(entry) {
  const { emails, audit } = await readAccess();
  const nextAudit = [{ action: entry.action, actor: entry.actor, target: entry.target, at: new Date().toISOString() }, ...audit].slice(0, 100);
  await writeFile(ADMIN_STORE_PATH, `${JSON.stringify({ emails, audit: nextAudit }, null, 2)}\n`);
  return nextAudit;
}

export async function saveManagedAdminsWithAudit(emails, entry) {
  const normalized = normalizeManagedAdmins(emails);
  const { audit } = await readAccess();
  const nextAudit = [{ action: entry.action, actor: entry.actor, target: entry.target, at: new Date().toISOString() }, ...audit].slice(0, 100);
  await writeFile(ADMIN_STORE_PATH, `${JSON.stringify({ emails: normalized, audit: nextAudit }, null, 2)}\n`);
  return { managedAdmins: normalized, audit: nextAudit };
}
