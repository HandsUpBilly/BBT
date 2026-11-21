import { contentEqual, reconcileItem } from './contentReconcile.js';

/**
 * GitHub PR export does a fresh three-way merge against the staging branch,
 * never overwriting a newer GitHub edit from an older live editor snapshot.
 */
export function planContentExport({ base, live, remote, kind, id }) {
  if (contentEqual(base, live)) return { change: null, conflicts: [] };
  const merged = reconcileItem(base, live, remote);
  if (merged.conflicts.length) return { change: null, conflicts: merged.conflicts };
  if (contentEqual(remote, merged.value)) return { change: null, conflicts: [] };
  return {
    change: {
      path: `client/src/${kind}/${id}.json`,
      value: merged.value,
    },
    conflicts: [],
  };
}
