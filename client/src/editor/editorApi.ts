import type { Scenario, SeriesDefinition } from '../types';
import type { PlayerStatistics } from '../../../shared/statistics.js';
import type { EngagementAnalytics } from '../../../shared/analyticsStatistics.js';
import type { AdminLoginEntry } from '../../../shared/loginTracking.js';

export interface EditorLoadResponse {
  scenarios: Scenario[];
  series: SeriesDefinition[];
  revisions: Record<string, number>;
  conflicts: Record<'scenarios' | 'series', Record<string, string[]>>;
  dirty?: Record<'scenarios' | 'series', string[]>;
  history?: Array<{ kind: string; id: string; revision: number; at: string; actor: string }>;
}

export interface AdminAccess {
  managedAdmins: string[];
  configuredAdminCount: number;
  audit: Array<{ action: 'added' | 'removed'; actor: string; target: string; at: string }>;
}

export interface ModeratedPlayerProfile {
  userId: string;
  country?: string;
  avatarVersion?: string;
  hasAvatar: boolean;
  updatedAt: string;
}

export interface RankingResetBoard {
  id: string;
  name: string;
  count: number;
}

export interface RankingResetSummary {
  totalEntries: number;
  series: RankingResetBoard[];
  puzzles: RankingResetBoard[];
}

export type RankingResetTarget =
  | { scope: 'all' }
  | { scope: 'series' | 'puzzle'; id: string };

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

/**
 * Server-authoritative navigation check. Any auth, network, or storage failure
 * fails closed so Puzzle Creator is never advertised without confirmed access.
 */
export async function fetchAdminStatus(idToken: string | null): Promise<boolean> {
  try {
    const response = await fetch('/api/editor/access', { headers: authHeaders(idToken) });
    if (!response.ok) return false;
    const body = await response.json() as { isAdmin?: unknown };
    return body.isAdmin === true;
  } catch {
    return false;
  }
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

export async function fetchPlayerLogins(idToken: string | null): Promise<AdminLoginEntry[]> {
  const response = await fetch('/api/editor/logins', { headers: authHeaders(idToken) });
  return parseJsonResponse<AdminLoginEntry[]>(response);
}

export async function updateLoginAdmin(userId: string, adding: boolean, idToken: string | null): Promise<AdminAccess> {
  const response = await fetch(`/api/editor/logins?userId=${encodeURIComponent(userId)}`, {
    method: adding ? 'POST' : 'DELETE',
    headers: authHeaders(idToken),
  });
  return parseJsonResponse<AdminAccess>(response);
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

export async function fetchModeratedPlayerProfiles(idToken: string | null): Promise<ModeratedPlayerProfile[]> {
  const response = await fetch('/api/editor/profiles', { headers: authHeaders(idToken) });
  return parseJsonResponse<ModeratedPlayerProfile[]>(response);
}

export async function removeModeratedAvatar(
  userId: string,
  idToken: string | null,
): Promise<ModeratedPlayerProfile> {
  const response = await fetch(`/api/editor/profiles?userId=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: authHeaders(idToken),
  });
  return parseJsonResponse<ModeratedPlayerProfile>(response);
}

export async function fetchRankingResetSummary(idToken: string | null): Promise<RankingResetSummary> {
  const response = await fetch('/api/editor/rankings', { headers: authHeaders(idToken) });
  return parseJsonResponse<RankingResetSummary>(response);
}

export async function resetRankings(
  target: RankingResetTarget,
  idToken: string | null,
): Promise<{ removed: number; summary: RankingResetSummary }> {
  const params = new URLSearchParams({ scope: target.scope });
  if ('id' in target) params.set('id', target.id);
  const response = await fetch(`/api/editor/rankings?${params}`, {
    method: 'DELETE',
    headers: authHeaders(idToken),
  });
  return parseJsonResponse<{ removed: number; summary: RankingResetSummary }>(response);
}

const revisionHeaders = (idToken: string | null, revision: number): HeadersInit => ({
  ...authHeaders(idToken), 'If-Match': String(revision),
});

export async function createScenario(scenario: Scenario, idToken: string | null): Promise<Scenario & { revision: number }> {
  const response = await fetch('/api/editor/scenarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...revisionHeaders(idToken, 0) },
    body: JSON.stringify(scenario),
  });
  return parseJsonResponse<Scenario & { revision: number }>(response);
}

export async function updateScenario(scenario: Scenario, idToken: string | null, revision: number): Promise<Scenario & { revision: number }> {
  const response = await fetch(`/api/editor/scenarios/${encodeURIComponent(scenario.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...revisionHeaders(idToken, revision) },
    body: JSON.stringify(scenario),
  });
  return parseJsonResponse<Scenario & { revision: number }>(response);
}

export async function deleteScenario(scenarioId: string, idToken: string | null, revision: number): Promise<EditorLoadResponse> {
  const response = await fetch(`/api/editor/scenarios/${encodeURIComponent(scenarioId)}`, {
    method: 'DELETE', headers: revisionHeaders(idToken, revision),
  });
  return parseJsonResponse<EditorLoadResponse>(response);
}

export async function saveSeries(series: SeriesDefinition, creating: boolean, idToken: string | null, revision: number): Promise<SeriesDefinition & { revision: number }> {
  const response = await fetch(creating ? '/api/editor/series' : `/api/editor/series/${encodeURIComponent(series.id)}`, {
    method: creating ? 'POST' : 'PUT',
    headers: { 'Content-Type': 'application/json', ...revisionHeaders(idToken, revision) },
    body: JSON.stringify(series),
  });
  return parseJsonResponse<SeriesDefinition & { revision: number }>(response);
}

export async function deleteSeries(seriesId: string, idToken: string | null, revision: number): Promise<EditorLoadResponse> {
  const response = await fetch(`/api/editor/series/${encodeURIComponent(seriesId)}`, {
    method: 'DELETE', headers: revisionHeaders(idToken, revision),
  });
  return parseJsonResponse<EditorLoadResponse>(response);
}

export async function fetchContentSyncStatus(idToken: string | null): Promise<{
  configured: boolean;
  dirty: Record<'scenarios' | 'series', string[]>;
  conflicts: Record<'scenarios' | 'series', Record<string, string[]>>;
}> {
  const response = await fetch('/api/editor/content-sync', { headers: authHeaders(idToken) });
  return parseJsonResponse(response);
}

export async function openContentSyncPullRequest(idToken: string | null): Promise<{
  synced: boolean;
  changes: number;
  pullRequest?: string;
}> {
  const response = await fetch('/api/editor/content-sync', {
    method: 'POST', headers: authHeaders(idToken),
  });
  return parseJsonResponse(response);
}

export interface ContentHistoryEntry {
  kind: 'scenarios' | 'series';
  id: string;
  revision: number;
  at: string;
  actor: string;
  canRestore: boolean;
}

export async function fetchContentHistory(
  kind: 'scenarios' | 'series', id: string, idToken: string | null,
): Promise<{ revision: number; changes: ContentHistoryEntry[] }> {
  const params = new URLSearchParams({ kind, id });
  const response = await fetch(`/api/editor/content-history?${params}`, {
    headers: authHeaders(idToken),
  });
  return parseJsonResponse(response);
}

export async function restoreContentHistory(
  kind: 'scenarios' | 'series', id: string, targetRevision: number,
  expectedRevision: number, idToken: string | null,
): Promise<{ revision: number }> {
  const response = await fetch('/api/editor/content-history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(idToken) },
    body: JSON.stringify({ kind, id, targetRevision, expectedRevision }),
  });
  return parseJsonResponse(response);
}
