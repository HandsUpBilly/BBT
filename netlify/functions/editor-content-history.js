import { editorStore, loadContent, readLegacyScenarios, readLegacySeries } from './editorStore.js';
import { contentVersions, ContentConflictError, writeContentItem } from './contentStore.js';
import { normalizeScenario, normalizeSeries, validateScenario, seriesMembershipErrors } from '../../shared/scenarioValidation.js';
import { AdminAuthError, authErrorResponse, requireAdminGoogleUser } from './auth.js';

const json = (status, value) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const validKind = kind => kind === 'scenarios' || kind === 'series';
const validId = id => typeof id === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(id);

export default async function handler(req) {
  if (!['GET', 'POST'].includes(req.method)) return json(405, { errors: ['Method not allowed'] });
  let admin;
  try { admin = await requireAdminGoogleUser(req); } catch (error) {
    if (error instanceof AdminAuthError) return authErrorResponse(error);
    throw error;
  }
  // Revision history contains unpublished content; no unauthenticated
  // bootstrap or open-local-editor fallback may read or restore it.
  if (!admin?.email) return json(403, { errors: ['A verified administrator is required for revision history.'] });
  const store = editorStore();
  const catalog = await loadContent(store);
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const kind = url.searchParams.get('kind');
    const id = url.searchParams.get('id');
    if (!validKind(kind) || !validId(id)) return json(400, { errors: ['Invalid item'] });
    return json(200, {
      id, kind, revision: catalog.revisions[`${kind}/${id}`] ?? 0,
      changes: catalog.history.filter(entry => entry.kind === kind && entry.id === id)
        .map(({ before, after, ...metadata }) => ({ ...metadata, canRestore: true })),
    });
  }
  let body;
  try { body = await req.json(); } catch { return json(400, { errors: ['Invalid JSON'] }); }
  const { kind, id, targetRevision, expectedRevision } = body ?? {};
  if (!validKind(kind) || !validId(id)
    || !Number.isSafeInteger(targetRevision) || !Number.isSafeInteger(expectedRevision)) {
    return json(400, { errors: ['Invalid restore request'] });
  }
  const entry = catalog.history.find(record =>
    record.kind === kind && record.id === id && record.revision === targetRevision);
  if (!entry) return json(404, { errors: ['Revision is outside the available live history'] });
  if (entry.after) {
    if (kind === 'scenarios') {
      const normalized = normalizeScenario(entry.after);
      const errors = validateScenario(normalized, new Set(), { allowExisting: true });
      if (errors.length) return json(409, { errors: ['Historical puzzle is no longer valid', ...errors] });
    } else {
      const normalized = normalizeSeries(entry.after);
      const missing = normalized.scenarioIds.filter(scenarioId =>
        !catalog.scenarios.some(scenario => scenario.id === scenarioId));
      const errors = seriesMembershipErrors(normalized, catalog.series, catalog.scenarios);
      if (missing.length || errors.length) {
        return json(409, { errors: [
          ...missing.map(scenarioId => `Historical series references missing puzzle ${scenarioId}`),
          ...errors,
        ] });
      }
    }
  }
  try {
    const result = await writeContentItem(store, async () => {
      const [scenarios, series] = await Promise.all([readLegacyScenarios(store), readLegacySeries(store)]);
      return { scenarios, series };
    }, { kind, id, expectedRevision, value: entry.after, actor: 'editor-restore' });
    return json(200, { revision: result.revision, ...contentVersions(result.catalog) });
  } catch (error) {
    if (error instanceof ContentConflictError) return json(409, { errors: [error.message] });
    throw error;
  }
}
