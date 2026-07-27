import type { Scenario, SeriesDefinition } from '../types';

interface EditorLoadResponse {
  scenarios: Scenario[];
  series: SeriesDefinition;
}

interface PublishResponse {
  scenarios: Scenario[];
  series: SeriesDefinition;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const body = await response.json();
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

export async function fetchEditorData(): Promise<EditorLoadResponse> {
  const response = await fetch('/api/editor/scenarios');
  return parseJsonResponse<EditorLoadResponse>(response);
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
