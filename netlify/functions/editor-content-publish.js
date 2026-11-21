import { editorStore, readLegacyScenarios, readLegacySeries } from './editorStore.js';
import { publishContentItem, contentVersions, ContentConflictError } from './contentStore.js';
import { AdminAuthError, authErrorResponse, requireAdminGoogleUser } from './auth.js';

const json = (status, data) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export default async function handler(req) {
  if (req.method !== 'POST') return json(405, { errors: ['Method not allowed'] });
  try { await requireAdminGoogleUser(req); } catch (error) {
    if (error instanceof AdminAuthError) return authErrorResponse(error);
    throw error;
  }
  let payload;
  try { payload = await req.json(); } catch { return json(400, { errors: ['Invalid JSON'] }); }
  const { kind, id, expectedRevision, expectedPublishedRevision } = payload ?? {};
  if (!['scenarios', 'series'].includes(kind) || typeof id !== 'string'
    || !/^[a-z0-9][a-z0-9-]*$/.test(id)
    || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0
    || !Number.isSafeInteger(expectedPublishedRevision) || expectedPublishedRevision < 0) {
    return json(400, { errors: ['Invalid publication request'] });
  }
  const store = editorStore();
  try {
    const result = await publishContentItem(store, async () => {
      const [scenarios, series] = await Promise.all([
        readLegacyScenarios(store), readLegacySeries(store),
      ]);
      return { scenarios, series };
    }, { kind, id, expectedRevision, expectedPublishedRevision });
    return json(200, {
      ...contentVersions(result.catalog),
      publishedRevision: result.publishedRevision,
      public: result.catalog[kind === 'scenarios' ? 'publishedScenarios' : 'publishedSeries']
        .some(item => item.id === id),
    });
  } catch (error) {
    if (error instanceof ContentConflictError) return json(409, { errors: [error.message] });
    throw error;
  }
}
