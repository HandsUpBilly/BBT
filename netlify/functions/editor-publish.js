import {
  editorStore,
  readDraftScenarios,
  readDraftSeries,
  writePublishedScenarios,
  writePublishedSeries,
} from './editorStore.js';
import { AdminAuthError, authErrorResponse, requireAdminGoogleUser } from './auth.js';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Copies the current draft scenarios/series (what the admin has been editing)
// into the published Blobs keys that netlify/functions/scenarios.js serves to
// players. This is the explicit "make it live" step — draft saves alone never
// reach players, so an admin can stage multiple edits before publishing.
export default async function handler(req) {
  if (req.method !== 'POST') {
    return jsonResponse(405, { errors: ['Method not allowed'] });
  }

  try {
    await requireAdminGoogleUser(req);
  } catch (error) {
    if (error instanceof AdminAuthError) return authErrorResponse(error);
    throw error;
  }

  const store = editorStore();
  const [scenarios, series] = await Promise.all([readDraftScenarios(store), readDraftSeries(store)]);

  await Promise.all([writePublishedScenarios(store, scenarios), writePublishedSeries(store, series)]);

  return jsonResponse(200, { scenarios, series });
}
