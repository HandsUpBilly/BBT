import type { Scenario, SeriesDefinition } from '../types';

interface EditorLoadResponse {
  scenarios: Scenario[];
  series: SeriesDefinition;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) {
    const message = Array.isArray(body.errors) ? body.errors.join('\n') : 'Editor request failed';
    throw new Error(message);
  }
  return body as T;
}

export async function fetchEditorData(): Promise<EditorLoadResponse> {
  const response = await fetch('/api/editor/scenarios');
  return parseJsonResponse<EditorLoadResponse>(response);
}

export async function createScenario(scenario: Scenario): Promise<Scenario> {
  const response = await fetch('/api/editor/scenarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scenario),
  });
  return parseJsonResponse<Scenario>(response);
}

export async function updateScenario(scenario: Scenario): Promise<Scenario> {
  const response = await fetch(`/api/editor/scenarios/${encodeURIComponent(scenario.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scenario),
  });
  return parseJsonResponse<Scenario>(response);
}

export async function updateDefaultSeries(series: SeriesDefinition): Promise<SeriesDefinition> {
  const response = await fetch('/api/editor/series/default', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(series),
  });
  return parseJsonResponse<SeriesDefinition>(response);
}
