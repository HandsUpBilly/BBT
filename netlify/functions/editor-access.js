import { AdminAuthError, authErrorResponse, requireAdminGoogleUser } from './auth.js';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store',
      Vary: 'Authorization',
    },
  });
}

export default async function handler(req) {
  if (req.method !== 'GET') return jsonResponse(405, { errors: ['Method not allowed'] });

  try {
    await requireAdminGoogleUser(req);
  } catch (error) {
    if (error instanceof AdminAuthError) return authErrorResponse(error);
    throw error;
  }

  // This endpoint is safe to call while rendering navigation: it reveals only
  // the caller's capability, not configured or managed administrator emails.
  return jsonResponse(200, { isAdmin: true });
}
