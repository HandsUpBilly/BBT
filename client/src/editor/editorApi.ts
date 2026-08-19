import type { Scenario, SeriesDefinition } from '../types';
import type { PlayerStatistics } from '../../../shared/statistics.js';
import type { EngagementAnalytics } from '../../../shared/analyticsStatistics.js';

interface EditorLoadResponse {
  scenarios: Scenario[];
  series: SeriesDefinition;
}

interface PublishResponse {
  scenarios: Scenario[];
  series: SeriesDefinition;
}

export interface AdminAccess {
  managedAdmins: string[];
  configuredAdminCount: number;
  audit: Array<{ action: 'added' | 'removed'; actor: string; target: string; at: string }>;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  let body: { errors?: unknown; error?: unknown };
  try {
    body = await response.json();
  } catch {
    // An HTML error page from a proxy, or an empty body.
    if (!response.ok) throw new Error(`Editor request failed (${response.status})`);
    throw new Error('Editor returned an unreadable response');
  }
  if (!response.ok) {
    // Validation errors use { errors: string[] }; auth failures (401/403) use { error: string }.
    const message = Array.isArray(body.errors)
      ? body.errors.join('\n')
      : typeof body.error === 'string'
        ? body.error
        : 'Editor request failed';
    throw new Error(message);
  }
  return body as T;
}

function authHeaders(idToken: string | null): HeadersInit {
  return idToken ? { Authorization: `Bearer ${idToken}` } : {};
}

// Drafts include unpublished puzzles, so the read is admin-gated like the
// writes and needs the same Authorization header.
export async function fetchEditorData(idToken: string | null): Promise<EditorLoadResponse> {
  const response = await fetch('/api/editor/scenarios', { headers: authHeaders(idToken) });
  return parseJsonResponse<EditorLoadResponse>(response);
}

export async function fetchPlayerStatistics(idToken: string | null, windowDays?: 7 | 30): Promise<PlayerStatistics> {
  const suffix = windowDays ? `?window=${windowDays}` : '';
  const response = await fetch(`/api/editor/statistics${suffix}`, { headers: authHeaders(idToken) });
  return parseJsonResponse<PlayerStatistics>(response);
}

export async function fetchEngagementAnalytics(
  idToken: string | null,
  windowDays: 7 | 30 | 90 | 365,
): Promise<EngagementAnalytics> {
  const response = await fetch(`/api/editor/analytics?window=${windowDays}`, { headers: authHeaders(idToken) });
  return parseJsonResponse<EngagementAnalytics>(response);
}

export async function fetchAdminAccess(idToken: string | null): Promise<AdminAccess> {
  const response = await fetch('/api/editor/admins', { headers: authHeaders(idToken) });
  return parseJsonResponse<AdminAccess>(response);
}

export async function addAdmin(email: string, idToken: string | null): Promise<AdminAccess> {
  const response = await fetch('/api/editor/admins', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders(idToken) }, body: JSON.stringify({ email }),
  });
  return parseJsonResponse<AdminAccess>(response);
}

export async function removeAdmin(email: string, idToken: string | null): Promise<AdminAccess> {
  const response = await fetch(`/api/editor/admins?email=${encodeURIComponent(email)}`, { method: 'DELETE', headers: authHeaders(idToken) });
  return parseJsonResponse<AdminAccess>(response);
}

export async function createScenario(scenario: Scenario, idToken: string | null): Promise<Scenario> {
  const response = await fetch('/api/editor/scenarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(idToken) },
    body: JSON.stringify(scenario),
  });
  return parseJsonResponse<Scenario>(response);
}

export async function updateScenario(scenario: Scenario, idToken: string | null): Promise<Scenario> {
  const response = await fetch(`/api/editor/scenarios/${encodeURIComponent(scenario.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders(idToken) },
    body: JSON.stringify(scenario),
  });
  return parseJsonResponse<Scenario>(response);
}

export async function deleteScenario(scenarioId: string, idToken: string | null): Promise<EditorLoadResponse> {
  const response = await fetch(`/api/editor/scenarios/${encodeURIComponent(scenarioId)}`, {
    method: 'DELETE',
    headers: authHeaders(idToken),
  });
  return parseJsonResponse<EditorLoadResponse>(response);
}

export async function updateDefaultSeries(series: SeriesDefinition, idToken: string | null): Promise<SeriesDefinition> {
  const response = await fetch('/api/editor/series/default', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders(idToken) },
    body: JSON.stringify(series),
  });
  return parseJsonResponse<SeriesDefinition>(response);
}

// Copies draft scenarios/series to the published state players see (Netlify),
// or is a no-op confirmation on local dev where draft writes are already live.
export async function publishEditorData(idToken: string | null): Promise<PublishResponse> {
  const response = await fetch('/api/editor/publish', {
    method: 'POST',
    headers: authHeaders(idToken),
  });
  return parseJsonResponse<PublishResponse>(response);
}
