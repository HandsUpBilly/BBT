import { STATIC_SCENARIOS, STATIC_SERIES } from './scenarioSeed.js';
import { reconcileCollection, contentEqual } from '../../shared/contentReconcile.js';
import { normalizeScenario, normalizeSeriesCollection, updateSeriesAssignment } from '../../shared/scenarioValidation.js';

export const CONTENT_KEY = 'content-v3/catalog';

export function catalogStorageKey(env = process.env) {
  if (env.CONTEXT === 'deploy-preview') {
    const id = String(env.REVIEW_ID ?? env.DEPLOY_ID ?? 'unknown').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 48);
    return `content-v3/preview-${id || 'unknown'}`;
  }
  if (env.CONTEXT === 'dev' || env.NETLIFY_DEV === 'true') return 'content-v3/local-dev';
  if (env.CONTEXT === 'branch-deploy') {
    const branch = String(env.BRANCH ?? 'staging').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 48);
    return `content-v3/branch-${branch || 'staging'}`;
  }
  return CONTENT_KEY;
}
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
    publishedScenarios: clone(legacy.scenarios.filter(item => item.published !== false)),
    publishedSeries: clone(legacy.series.filter(item => item.published !== false)),
    publishedRevisions: revisionsFor(legacy.scenarios, legacy.series),
    conflicts: { scenarios: {}, series: {} },
    history: [],
  };
}

async function fetchSnapshot(store) {
  const current = await store.getWithMetadata(catalogStorageKey(), { type: 'text' });
  if (!current?.data) return { snapshot: null, etag: null };
  let snapshot;
  try { snapshot = JSON.parse(current.data); } catch { throw new ContentStoreError('Stored content is corrupt; manual recovery required'); }
  if (snapshot?.schema !== 3 || !Array.isArray(snapshot.scenarios) || !Array.isArray(snapshot.series)) {
    throw new ContentStoreError('Unsupported content version; manual recovery required');
  }
  if (!current.etag) throw new ContentStoreError('Content store did not provide an ETag; refusing unsafe writes');
  return { snapshot, etag: current.etag };
}

/**
 * Upgrade existing v3 catalogues without touching legacy backups or rewriting
 * puzzle drafts. Before this release saves were immediately public, so their
 * effective published content is the exact current enabled view.
 */
function upgradePublicationSnapshot(snapshot) {
  if (Array.isArray(snapshot.publishedScenarios)
    && Array.isArray(snapshot.publishedSeries)
    && snapshot.publishedRevisions) return null;
  return {
    ...snapshot,
    publishedScenarios: clone(snapshot.scenarios.filter(item => item.published !== false)),
    publishedSeries: clone(snapshot.series.filter(item => item.published !== false)),
    publishedRevisions: { ...snapshot.revisions },
  };
}

async function casWrite(store, snapshot, etag) {
  const options = etag ? { onlyIfMatch: etag } : { onlyIfNew: true };
  const result = await store.set(catalogStorageKey(), JSON.stringify(snapshot), options);
  return result?.modified === true;
}

function valueAtPath(item, path) {
  if (path.length === 1 && path.charCodeAt(0) === 36) return item;
  const segments = path.split('.');
  let value = item;
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index];
    if (index === 1 && segments[0] === 'pieces' && Array.isArray(value)) {
      value = value.find(piece => piece.id === segment);
    } else {
      value = value && typeof value === 'object' ? value[segment] : undefined;
    }
  }
  return value;
}

function retainUnresolvedConflicts(previous, fresh, currentItems, remoteItems) {
  const live = new Map(currentItems.map(item => [item.id, item]));
  const remote = new Map(remoteItems.map(item => [item.id, item]));
  const result = { ...fresh };
  for (const [id, oldPaths] of Object.entries(previous ?? {})) {
    const unresolved = oldPaths.filter(path =>
      !contentEqual(valueAtPath(live.get(id), path), valueAtPath(remote.get(id), path)));
    if (unresolved.length) result[id] = [...new Set([...(result[id] ?? []), ...unresolved])];
  }
  return result;
}

export function reconcileToDeployment(snapshot, next = source()) {
  const before = snapshot.baseline;
  if (contentEqual(before, next)) return null;
  const a = reconcileCollection(before.scenarios, snapshot.scenarios, next.scenarios);
  const b = reconcileCollection(before.series, snapshot.series, next.series);
  const publishedScenarios = snapshot.publishedScenarios ?? snapshot.scenarios.filter(item => item.published !== false);
  const publishedSeries = snapshot.publishedSeries ?? snapshot.series.filter(item => item.published !== false);
  // Repository deployments update published content automatically, but
  // unpublished editor drafts remain separate until explicitly promoted.
  const publishedA = reconcileCollection(before.scenarios, publishedScenarios, next.scenarios);
  const publishedB = reconcileCollection(before.series, publishedSeries, next.series);
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
  const publishedRevisions = { ...(snapshot.publishedRevisions ?? snapshot.revisions) };
  const trackPublic = (kind, oldItems, updatedItems) => {
    const oldMap = new Map(oldItems.map(item => [item.id, item]));
    const newMap = new Map(updatedItems.map(item => [item.id, item]));
    for (const id of new Set([...oldMap.keys(), ...newMap.keys()])) {
      if (!contentEqual(oldMap.get(id), newMap.get(id))) {
        const key = ref(kind, id);
        publishedRevisions[key] = (publishedRevisions[key] ?? 0) + 1;
      }
    }
  };
  trackPublic('scenarios', publishedScenarios, publishedA.items);
  trackPublic('series', publishedSeries, publishedB.items);
  return {
    ...snapshot, baseline: clone(next), scenarios: a.items, series: b.items, revisions,
    publishedScenarios: publishedA.items.filter(item => item.published !== false),
    publishedSeries: publishedB.items.filter(item => item.published !== false),
    publishedRevisions,
    conflicts: {
      scenarios: retainUnresolvedConflicts(snapshot.conflicts?.scenarios, a.conflicts, a.items, next.scenarios),
      series: retainUnresolvedConflicts(snapshot.conflicts?.series, b.conflicts, b.items, next.series),
    },
  };
}

/**
 * GitHub deploys reconcile on the next read. Edited fields survive; independent
 * GitHub changes merge; conflicts remain visible to admins and never overwrite
 * either version without an explicit follow-up.
 */
export async function readContentCatalog(store, readLegacy, { withEtag = false } = {}) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { snapshot, etag } = await fetchSnapshot(store);
    if (!snapshot) {
      // Non-production previews must not seed themselves by reading/writing
      // the legacy production Blob keys. Start from their built-in branch data.
      const isolated = ['deploy-preview', 'branch-deploy', 'dev'].includes(process.env.CONTEXT);
      const legacy = isolated ? source() : await readLegacy();
      const fresh = initialCatalog(legacy);
      if (await casWrite(store, fresh, null)) {
        if (!withEtag) return fresh;
        continue; // Fetch the newly created ETag before applying a write.
      }
      continue;
    }
    const upgraded = upgradePublicationSnapshot(snapshot);
    if (upgraded) {
      if (await casWrite(store, upgraded, etag)) {
        if (!withEtag) return upgraded;
        continue;
      }
      continue;
    }
    const reconciled = reconcileToDeployment(snapshot);
    if (!reconciled) return withEtag ? { catalog: snapshot, etag } : snapshot;
    if (await casWrite(store, reconciled, etag)) {
      if (!withEtag) return reconciled;
      continue; // The CAS changed the ETag; fetch it before editing.
    }
  }
  throw new ContentConflictError('The catalogue changed repeatedly during synchronisation. Retry.');
}

export function contentVersions(catalog) {
  return {
    revisions: { ...catalog.revisions },
    publishedRevisions: { ...catalog.publishedRevisions },
    pendingPublish: Object.fromEntries(['scenarios', 'series'].map(kind => {
      const pubKey = kind === 'scenarios' ? 'publishedScenarios' : 'publishedSeries';
      const draft = new Map(catalog[kind].map(item => [item.id, item]));
      const published = new Map(catalog[pubKey].map(item => [item.id, item]));
      return [kind, [...new Set([...draft.keys(), ...published.keys()])]
        .filter(id => {
          const intended = draft.get(id)?.published !== false ? draft.get(id) : undefined;
          return !contentEqual(intended, published.get(id));
        })];
    })),
    conflicts: clone(catalog.conflicts),
    dirty: Object.fromEntries(['scenarios', 'series'].map(kind => {
      const base = new Map(catalog.baseline[kind].map(item => [item.id, item]));
      const live = new Map(items(catalog, kind).map(item => [item.id, item]));
      return [kind, [...new Set([...base.keys(), ...live.keys()])]
        .filter(id => !contentEqual(live.get(id), base.get(id)))];
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
    const { catalog, etag } = await readContentCatalog(store, readLegacy, { withEtag: true });
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
      conflicts: {
        ...catalog.conflicts,
        [kind]: {
          ...catalog.conflicts[kind],
          [id]: (catalog.conflicts[kind]?.[id] ?? []).filter(path =>
            !contentEqual(valueAtPath(value ?? undefined, path),
              valueAtPath(catalog.baseline[kind].find(item => item.id === id), path))),
        },
      },
      history: [...catalog.history, { kind, id, revision, at: new Date().toISOString(),
        actor, before: previous ?? null, after: value }].slice(-HISTORY_LIMIT),
    };
    // Explicit deletion is destructive and already requires a separate
    // confirmation in the editor. Unpublish the deleted item atomically so
    // players never retain a ghost puzzle without a draft to manage it.
    if (value === null) {
      const publicKey = kind === 'scenarios' ? 'publishedScenarios' : 'publishedSeries';
      if (catalog[publicKey].some(item => item.id === id)) {
        updated[publicKey] = catalog[publicKey].filter(item => item.id !== id);
        updated.publishedRevisions = {
          ...catalog.publishedRevisions,
          [key]: (catalog.publishedRevisions[key] ?? 0) + 1,
        };
      }
    }
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
    if (kind === 'scenarios' && value === null) {
      const changedPublished = catalog.publishedSeries.map(item => ({
        ...item, scenarioIds: item.scenarioIds.filter(scenarioId => scenarioId !== id),
      }));
      updated.publishedSeries = changedPublished;
      for (const series of changedPublished) {
        const before = catalog.publishedSeries.find(item => item.id === series.id);
        if (!contentEqual(before, series)) {
          const pubKey = ref('series', series.id);
          updated.publishedRevisions = {
            ...(updated.publishedRevisions ?? catalog.publishedRevisions),
            [pubKey]: ((updated.publishedRevisions ?? catalog.publishedRevisions)[pubKey] ?? 0) + 1,
          };
        }
      }
    }
    // ETag belongs to the snapshot we actually edited; a concurrent writer
    // forces a retry even if it changed a different puzzle.
    if (await casWrite(store, updated, etag)) return { catalog: updated, revision };
  }
  throw new ContentConflictError('Concurrent content updates exceeded retry limit.');
}

/**
 * Moving a puzzle between series is one atomic multi-item mutation.
 * The caller must acknowledge the current revision of every affected series.
 */
export async function writeContentAssignment(store, readLegacy, {
  scenarioId, targetSeriesId, expectedRevisions,
}) {
  if (!expectedRevisions || typeof expectedRevisions !== 'object') {
    throw new ContentConflictError('Current series revisions are required.');
  }
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { catalog, etag } = await readContentCatalog(store, readLegacy, { withEtag: true });
    const { series, errors } = updateSeriesAssignment(
      catalog.series, scenarioId, targetSeriesId, catalog.scenarios,
    );
    if (errors.length) return { catalog, errors };
    if (series === catalog.series) return { catalog, errors: [] };
    const revisions = { ...catalog.revisions };
    const changed = [];
    for (const item of series) {
      const original = catalog.series.find(before => before.id === item.id);
      if (contentEqual(original, item)) continue;
      const key = ref('series', item.id);
      if (expectedRevisions[item.id] !== (revisions[key] ?? 0)) {
        throw new ContentConflictError(`Series ${item.id} changed. Reload before moving puzzle membership.`);
      }
      revisions[key] = (revisions[key] ?? 0) + 1;
      changed.push({
        kind: 'series', id: item.id, revision: revisions[key],
        at: new Date().toISOString(), actor: 'editor-assignment',
        before: original ?? null, after: item,
      });
    }
    const updated = {
      ...catalog, series, revisions,
      history: [...catalog.history, ...changed].slice(-HISTORY_LIMIT),
    };
    if (await casWrite(store, updated, etag)) return { catalog: updated, errors: [] };
  }
  throw new ContentConflictError('Concurrent series updates exceeded retry limit.');
}

/**
 * Publish the exact saved draft revision. The public view is independent of
 * subsequent Save Draft changes until this succeeds. A previously disabled
 * item can be unpublished by saving published=false and publishing that draft.
 */
export async function publishContentItem(store, readLegacy, {
  kind, id, expectedRevision, expectedPublishedRevision, actor = 'editor-publish',
}) {
  if (!['scenarios', 'series'].includes(kind)) throw new TypeError('Invalid kind');
  if (![expectedRevision, expectedPublishedRevision].every(value =>
    Number.isSafeInteger(value) && value >= 0)) {
    throw new ContentConflictError('Current draft and published revisions are required.');
  }
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { catalog, etag } = await readContentCatalog(store, readLegacy, { withEtag: true });
    const key = ref(kind, id);
    if ((catalog.revisions[key] ?? 0) !== expectedRevision
      || (catalog.publishedRevisions[key] ?? 0) !== expectedPublishedRevision) {
      throw new ContentConflictError('Draft or published content changed. Reload before publishing.');
    }
    const draft = catalog[kind].find(item => item.id === id);
    const publicKey = kind === 'scenarios' ? 'publishedScenarios' : 'publishedSeries';
    const previous = catalog[publicKey].find(item => item.id === id);
    const next = draft?.published !== false ? draft : undefined;
    if (!draft && !previous) throw new ContentConflictError('There is no saved content to publish.');
    if (kind === 'series' && next) {
      const liveIds = new Set(catalog.publishedScenarios.map(item => item.id));
      const missing = next.scenarioIds.filter(itemId => !liveIds.has(itemId));
      if (missing.length) throw new ContentConflictError(
        `Publish its puzzles first: ${missing.join(', ')}`);
    }
    if (contentEqual(previous, next)) return { catalog, publishedRevision: expectedPublishedRevision };
    const updated = {
      ...catalog,
      [publicKey]: [
        ...catalog[publicKey].filter(item => item.id !== id),
        ...(next ? [clone(next)] : []),
      ],
      publishedRevisions: {
        ...catalog.publishedRevisions,
        [key]: expectedPublishedRevision + 1,
      },
      publishedHistory: [...(catalog.publishedHistory ?? []), {
        kind, id, revision: expectedPublishedRevision + 1, at: new Date().toISOString(),
        actor, before: previous ?? null, after: next ?? null,
      }].slice(-HISTORY_LIMIT),
    };
    if (await casWrite(store, updated, etag)) {
      return { catalog: updated, publishedRevision: expectedPublishedRevision + 1 };
    }
  }
  throw new ContentConflictError('Concurrent publication updates exceeded retry limit.');
}

export function contentPublicView(catalog) {
  const scenarios = catalog.publishedScenarios.map(normalizeScenario);
  const published = new Set(scenarios.map(item => item.id));
  const series = normalizeSeriesCollection(catalog.publishedSeries)
    .map(item => ({ ...item, scenarioIds: item.scenarioIds.filter(id => published.has(id)) }));
  return { scenarios, series };
}
