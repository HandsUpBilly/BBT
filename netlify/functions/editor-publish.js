import {
  editorStore,
  readDraftScenarios,
  readDraftSeries,
} from './editorStore.js';
import { AdminAuthError, authErrorResponse, requireAdminGoogleUser } from './auth.js';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Compatibility endpoint for older cached clients. Saves are now live
// immediately, so there is no separate publish operation to perform.
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

  return jsonResponse(200, { scenarios, series });
}
