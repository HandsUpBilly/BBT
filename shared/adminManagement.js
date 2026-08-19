// Shared, dependency-free normalization for the runtime administrator list.
// Deployment administrators remain in ADMIN_EMAILS; this list contains only
// administrators added from the console.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ADMINS = 100;

export function normalizeAdminEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

export function normalizeManagedAdmins(value) {
  const emails = Array.isArray(value) ? value : value?.emails;
  if (!Array.isArray(emails)) return [];
  return [...new Set(emails.map(normalizeAdminEmail).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right))
    .slice(0, MAX_ADMINS);
}

export function addManagedAdmin(current, rawEmail) {
  const email = normalizeAdminEmail(rawEmail);
  if (!email) throw new Error('Enter a valid administrator email address.');
  return normalizeManagedAdmins([...normalizeManagedAdmins(current), email]);
}

export function removeManagedAdmin(current, rawEmail) {
  const email = normalizeAdminEmail(rawEmail);
  if (!email) throw new Error('Enter a valid administrator email address.');
  return normalizeManagedAdmins(current).filter(existing => existing !== email);
}
