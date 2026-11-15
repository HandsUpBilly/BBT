/**
 * Three-way reconciliation for version-controlled puzzle content.
 *
 * base: GitHub version last observed by the live editor
 * local: saved editor version (null is an intentional deletion)
 * remote: GitHub version in the currently deployed build (null is deletion)
 *
 * Disjoint field edits merge. Competing edits keep the live version and are
 * reported with an exact path; they are never silently overwritten.
 */
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value ?? {}, key);

function reconcileValue(base, local, remote, path, conflicts) {
  if (same(local, base)) return structuredClone(remote);
  if (same(remote, base) || same(local, remote)) return structuredClone(local);
  if (object(local) && object(remote) && (object(base) || base === undefined)) {
    const result = {};
    const keys = new Set([...Object.keys(base ?? {}), ...Object.keys(local), ...Object.keys(remote)]);
    for (const key of keys) {
      const nextPath = path ? `${path}.${key}` : key;
      const merged = reconcileValue(
        own(base, key) ? base[key] : undefined,
        own(local, key) ? local[key] : undefined,
        own(remote, key) ? remote[key] : undefined,
        nextPath, conflicts,
      );
      if (merged !== undefined) result[key] = merged;
    }
    return result;
  }
  // Pieces are identified by stable id; different players can safely change
  // independently, and even distinct fields of the same player can merge.
  if (path === 'pieces' && Array.isArray(local) && Array.isArray(remote)
    && Array.isArray(base) && [...base, ...local, ...remote].every(item => object(item) && typeof item.id === 'string')) {
    const baseById = new Map(base.map(item => [item.id, item]));
    const localById = new Map(local.map(item => [item.id, item]));
    const remoteById = new Map(remote.map(item => [item.id, item]));
    const order = [...new Set([...remote.map(item => item.id), ...local.map(item => item.id)])];
    return order.map(id => reconcileValue(baseById.get(id), localById.get(id), remoteById.get(id), `pieces.${id}`, conflicts))
      .filter(item => item !== undefined);
  }
  // Array ordering, simultaneous deletion/edits, and incompatible stat edits
  // need a human decision. Keep the editor version until that decision.
  conflicts.push(path || '$');
  return structuredClone(local);
}

export function reconcileItem(base, local, remote) {
  const conflicts = [];
  return { value: reconcileValue(base, local, remote, '', conflicts), conflicts };
}

export function contentEqual(a, b) {
  return same(a, b);
}

export function contentById(items) {
  return new Map((items ?? []).map(item => [item.id, item]));
}

/** Preserve editor-created records and tombstones when GitHub changes. */
export function reconcileCollection(baseItems, liveItems, remoteItems) {
  const before = contentById(baseItems);
  const local = contentById(liveItems);
  const remote = contentById(remoteItems);
  const order = [...new Set([...remote.keys(), ...local.keys(), ...before.keys()])];
  const conflicts = {};
  const items = [];
  for (const id of order) {
    const result = reconcileItem(before.get(id), local.get(id), remote.get(id));
    if (result.value !== undefined) items.push(result.value);
    if (result.conflicts.length) conflicts[id] = result.conflicts;
  }
  return { items, conflicts };
}
