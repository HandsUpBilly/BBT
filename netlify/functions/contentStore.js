import { STATIC_SCENARIOS, STATIC_SERIES } from './scenarioSeed.js';
import { reconcileCollection, contentEqual } from '../../shared/contentReconcile.js';
import { normalizeScenario, normalizeSeriesCollection } from '../../shared/scenarioValidation.js';

export const CONTENT_KEY = 'content-v3/catalog';
const MAX_RETRIES = 6;
const HISTORY_LIMIT = 40;
const clone = value => structuredClone(value);
const ref = (kind, id) => `${kind}/${id}`;
const items = (catalog, kind) => kind === 'scenarios' ? catalog.scenarios : catalog.series;
const source = () => ({ scenarios: STATIC_SCENARIOS, series: STATIC_SERIES });

export class ContentConflictError extends Error {
  constructor(message = 'This item has changed since you opened it. Reload it before saving.') {
    super(message);
    this.name = 'ContentConflictError';
  }
}

export class ContentStoreError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ContentStoreError';
  }
}

function revisionsFor(scenarios, series) {
  return Object.fromEntries([
    ...scenarios.map(item => [ref('scenarios', item.id), 1]),
    ...series.map(item => [ref('series', item.id), 1]),
  ]);
}

function initialCatalog(legacy) {
  return {
    schema: 3,
    baseline: source(),
    scenarios: clone(legacy.scenarios),
    series: clone(legacy.series),
    revisions: revisionsFor(legacy.scenarios, legacy.series),
    conflicts: { scenarios: {}, series: {} },
    history: [],
  };
}

async function fetchSnapshot(store) {
  const current = await store.getWithMetadata(CONTENT_KEY, { type: 'text' });
  if (!current?.data) return { snapshot: null, etag: null };
  let snapshot;
  try { snapshot = JSON.parse(current.data); } catch { throw new ContentStoreError('Stored content is corrupt; manual recovery required'); }
  if (snapshot?.schema !== 3 || !Array.isArray(snapshot.scenarios) || !Array.isArray(snapshot.series)) {
    throw new ContentStoreError('Unsupported content version; manual recovery required');
  }
  if (!current.etag) throw new ContentStoreError('Content store did not provide an ETag; refusing unsafe writes');
  return { snapshot, etag: current.etag };
}

async function casWrite(store, snapshot, etag) {
  const options = etag ? { onlyIfMatch: etag } : { onlyIfNew: true };
  const result = await store.set(CONTENT_KEY, JSON.stringify(snapshot), options);
  return result?.modified === true;
}

function reconcileToDeployment(snapshot) {
  const next = source();
  const before = snapshot.baseline;
  if (contentEqual(before, next)) return null;
  const a = reconcileCollection(before.scenarios, snapshot.scenarios, next.scenarios);
  const b = reconcileCollection(before.series, snapshot.series, next.series);
  const revisions = { ...snapshot.revisions };
  const recordChanges = (kind, oldItems, newItems) => {
    const old = new Map(oldItems.map(item => [item.id, item]));
    const updated = new Map(newItems.map(item => [item.id, item]));
    for (const id of new Set([...old.keys(), ...updated.keys()])) {
      if (!contentEqual(old.get(id), updated.get(id))) {
        const key = ref(kind, id);
        revisions[key] = (revisions[key] ?? 0) + 1;
      }
    }
  };
  recordChanges('scenarios', snapshot.scenarios, a.items);
  recordChanges('series', snapshot.series, b.items);
  return {
    ...snapshot, baseline: clone(next), scenarios: a.items, series: b.items, revisions,
    conflicts: { scenarios: a.conflicts, series: b.conflicts },
  };
}

/**
 * GitHub deploys reconcile on the next read. Edited fields survive; independent
 * GitHub changes merge; conflicts remain visible to admins and never overwrite
 * either version without an explicit follow-up.
 */
export async function readContentCatalog(store, readLegacy) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { snapshot, etag } = await fetchSnapshot(store);
    if (!snapshot) {
      const legacy = await readLegacy();
      const fresh = initialCatalog(legacy);
      if (await casWrite(store, fresh, null)) return fresh;
      continue;
    }
    const reconciled = reconcileToDeployment(snapshot);
    if (!reconciled) return snapshot;
    if (await casWrite(store, reconciled, etag)) return reconciled;
  }
  throw new ContentConflictError('The catalogue changed repeatedly during synchronisation. Retry.');
}

export function contentVersions(catalog) {
  return {
    revisions: { ...catalog.revisions },
    conflicts: clone(catalog.conflicts),
    dirty: Object.fromEntries(['scenarios', 'series'].map(kind => {
      const base = new Map(catalog.baseline[kind].map(item => [item.id, item]));
      return [kind, items(catalog, kind).filter(item => !contentEqual(item, base.get(item.id))).map(item => item.id)];
    })),
  };
}

/**
 * Optimistic item save. A CAS retry always reloads and reapplies this ONE item,
 * so simultaneous edits to unrelated puzzles or series cannot lose updates.
 * The expected revision is checked on every retry.
 */
export async function writeContentItem(store, readLegacy, { kind, id, value, expectedRevision, actor = 'editor' }) {
  if (!['scenarios', 'series'].includes(kind)) throw new TypeError('Invalid content kind');
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    throw new ContentConflictError('A content revision is required. Reload the editor.');
  }
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const catalog = await readContentCatalog(store, readLegacy);
    const key = ref(kind, id);
    const actualRevision = catalog.revisions[key] ?? 0;
    if (actualRevision !== expectedRevision) throw new ContentConflictError();
    const current = items(catalog, kind);
    const previous = current.find(item => item.id === id);
    if (contentEqual(previous, value)) return { catalog, revision: actualRevision };
    const updatedItems = current.filter(item => item.id !== id);
    if (value !== null) updatedItems.push(clone(value));
    const revision = actualRevision + 1;
    const updated = {
      ...catalog, [kind]: updatedItems,
      revisions: { ...catalog.revisions, [key]: revision },
      conflicts: { ...catalog.conflicts, [kind]: { ...catalog.conflicts[kind], [id]: [] } },
      history: [...catalog.history, { kind, id, revision, at: new Date().toISOString(),
        actor, before: previous ?? null, after: value }].slice(-HISTORY_LIMIT),
    };
    if (kind === 'scenarios' && value === null) {
      updated.series = catalog.series.map(series => ({
        ...series, scenarioIds: series.scenarioIds.filter(scenarioId => scenarioId !== id),
      }));
      for (const series of updated.series) {
        const old = catalog.series.find(item => item.id === series.id);
        if (!contentEqual(old, series)) updated.revisions[ref('series', series.id)] =
          (updated.revisions[ref('series', series.id)] ?? 0) + 1;
      }
    }
    const { etag } = await fetchSnapshot(store);
    // Do not let a stale copy overwrite a concurrent commit even when the
    // second writer changed a different record.
    if (await casWrite(store, updated, etag)) return { catalog: updated, revision };
  }
  throw new ContentConflictError('Concurrent content updates exceeded retry limit.');
}

export function contentPublicView(catalog) {
  const scenarios = catalog.scenarios.filter(item => item.published !== false).map(normalizeScenario);
  const published = new Set(scenarios.map(item => item.id));
  const series = normalizeSeriesCollection(catalog.series)
    .filter(item => item.published !== false)
    .map(item => ({ ...item, scenarioIds: item.scenarioIds.filter(id => published.has(id)) }));
  return { scenarios, series };
}
