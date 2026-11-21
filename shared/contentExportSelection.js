/**
 * Explicit selection contract for live editor exports. Neither omitted nor
 * wildcard selections may fall back to exporting the entire live catalogue.
 */
export const CONTENT_KINDS = Object.freeze(['scenarios', 'series']);
const VALID_ID = /^[a-z0-9][a-z0-9-]*$/;

export function parseExportSelection(value, allowed) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50) {
    throw new TypeError('Select between 1 and 50 specific content items before exporting.');
  }
  const seen = new Set();
  return value.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)
      || !CONTENT_KINDS.includes(item.kind) || !VALID_ID.test(item.id ?? '')
      || !Number.isSafeInteger(item.revision) || item.revision < 0) {
      throw new TypeError('Invalid content selection or revision.');
    }
    const key = `${item.kind}/${item.id}`;
    if (seen.has(key)) throw new TypeError(`Duplicate selection: ${key}`);
    seen.add(key);
    if (!allowed.has(key)) throw new TypeError(`No pending live changes for ${key}`);
    return { kind: item.kind, id: item.id, revision: item.revision };
  });
}

export function filterExportItems(versions, selection) {
  const selected = new Set(selection.map(item => `${item.kind}/${item.id}`));
  return CONTENT_KINDS.flatMap(kind => versions.dirty[kind]
    .filter(id => selected.has(`${kind}/${id}`))
    .map(id => ({ kind, id })));
}
