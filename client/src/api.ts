import type { ActionLogEntry, LeaderboardEntry, RiskyMove, SeriesLeaderboardEntry, SeriesPuzzleResult } from './types';
// Same module the server uses to build GitHub issue bodies, so the offline
// download fallback is byte-identical to what would have been filed.
import { createDownload, REPORT_LIMITS } from '../../shared/reporting.js';
import { CONTACT_LIMITS } from '../../shared/contactMessage.js';
import type { SubmissionNode } from './branchRun';

const BASE = '/api';

export { REPORT_LIMITS, CONTACT_LIMITS };

export type ReportType = 'issue' | 'feature';

export interface ReportContext {
  mode: string;
  scenarioId?: string;
  scenarioName?: string;
  appVersion?: string;
  userAgent?: string;
}

export interface ReportInput {
  type: ReportType;
  title: string;
  description: string;
  reporterName: string;
  context: ReportContext;
}

export interface ReportSubmission {
  number: number;
  url: string;
}

export interface ReportDownload {
  fileName: string;
  content: string;
}

export interface ContactInput {
  name: string;
  email: string;
  message: string;
}

export interface ContactSubmission {
  id: string;
}

/** Combined home-screen progress: every scenario board plus the series board. */
export interface ProgressData {
  scenarios: Record<string, LeaderboardEntry[]>;
  series: SeriesLeaderboardEntry[];
}

/** Carries the HTTP status so callers can tell "signed out" from "server down". */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export class ReportSubmissionError extends Error {
  readonly download?: ReportDownload;

  constructor(message: string, download?: ReportDownload) {
    super(message);
    this.name = 'ReportSubmissionError';
    this.download = download;
  }
}

export class ContactSubmissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContactSubmissionError';
  }
}

/** Rejects with ApiError on a non-2xx, preferring the server's own message. */
async function requireOk(res: Response, fallback: string): Promise<Response> {
  if (res.ok) return res;
  let message = fallback;
  try {
    const body = await res.json() as { error?: string; errors?: string[] };
    message = body.error ?? body.errors?.join(' ') ?? fallback;
  } catch {
    // Non-JSON error body (proxy, gateway) — keep the fallback message.
  }
  throw new ApiError(res.status, message);
}

function authHeaders(idToken?: string | null): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
  };
}

export async function fetchLeaderboard(scenarioId: string): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${BASE}/leaderboard/${encodeURIComponent(scenarioId)}`);
  return (await requireOk(res, 'Could not load the leaderboard')).json();
}

export async function submitScore(
  scenarioId: string,
  name: string,
  probability: number,
  diceCount: number,
  moves: RiskyMove[],
  playLog: ActionLogEntry[],
  idToken?: string | null,
  /**
   * Branch tree for a branching run. Its presence tells the server the score is
   * a sum over branches rather than the product of one line's rolls, so it
   * recomputes from the tree instead of from `moves`.
   */
  tree?: SubmissionNode,
): Promise<LeaderboardEntry> {
  const res = await fetch(`${BASE}/leaderboard/${encodeURIComponent(scenarioId)}`, {
    method: 'POST',
    headers: authHeaders(idToken),
    body: JSON.stringify({ name, probability, diceCount, moves, playLog, ...(tree ? { tree } : {}) }),
  });
  return (await requireOk(res, 'Failed to submit score')).json();
}

export async function fetchSeriesLeaderboard(): Promise<SeriesLeaderboardEntry[]> {
  const res = await fetch(`${BASE}/series-leaderboard`);
  return (await requireOk(res, 'Could not load the series leaderboard')).json();
}

export async function submitSeriesScore(
  name: string,
  probability: number,
  diceCount: number,
  puzzles: SeriesPuzzleResult[],
  idToken?: string | null,
): Promise<SeriesLeaderboardEntry> {
  const res = await fetch(`${BASE}/series-leaderboard`, {
    method: 'POST',
    headers: authHeaders(idToken),
    body: JSON.stringify({ name, probability, diceCount, puzzles }),
  });
  return (await requireOk(res, 'Failed to submit series score')).json();
}

/**
 * One request for the whole home screen. Progress is decoration — an empty
 * result just shows "Not played", so a failure here is swallowed rather than
 * blocking the screen.
 */
export async function fetchProgress(): Promise<ProgressData> {
  try {
    const res = await fetch(`${BASE}/progress`);
    if (!res.ok) return { scenarios: {}, series: [] };
    const data = await res.json() as Partial<ProgressData>;
    return {
      scenarios: data.scenarios ?? {},
      series: Array.isArray(data.series) ? data.series : [],
    };
  } catch {
    return { scenarios: {}, series: [] };
  }
}

/** Best-effort analytics transport. Product telemetry must never interrupt play. */
export async function submitAnalyticsBatch(payload: unknown, keepalive = false): Promise<boolean> {
  try {
    const response = await fetch(`${BASE}/analytics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive,
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Records one login for this session, keyed server-side by Google account or
 * guest handle — see shared/loginTracking.js. Fire-and-forget, same posture as
 * submitAnalyticsBatch: this is a usage record, not something play should ever
 * wait on or fail over.
 */
export async function recordLogin(name: string, idToken?: string | null): Promise<void> {
  try {
    await fetch(`${BASE}/logins`, {
      method: 'POST',
      headers: authHeaders(idToken),
      body: JSON.stringify({ name }),
    });
  } catch {
    // Best-effort — a missed login record isn't worth surfacing to the player.
  }
}

/** Used only if the request never reaches the server, so the player can still
 * save a report that matches the server-created issue layout. */
export function createReportDownload(input: ReportInput): ReportDownload {
  return createDownload(
    { ...input, context: input.context },
    input.reporterName,
  );
}

export async function submitReport(input: ReportInput, idToken?: string | null): Promise<ReportSubmission> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/reports`, {
      method: 'POST',
      headers: authHeaders(idToken),
      body: JSON.stringify(input),
    });
  } catch {
    throw new ReportSubmissionError('Could not reach the report service');
  }

  if (res.ok) return res.json();

  let payload: { error?: string; download?: ReportDownload } = {};
  try {
    payload = await res.json() as { error?: string; download?: ReportDownload };
  } catch {
    // Keep the generic error below when an intermediary returns non-JSON.
  }
  throw new ReportSubmissionError(payload.error ?? 'Could not submit the report', payload.download);
}

/** No idToken here — the contact form is open to guests too. */
export async function submitContact(input: ContactInput): Promise<ContactSubmission> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    throw new ContactSubmissionError('Could not reach the contact service');
  }

  if (res.ok) return res.json();

  let payload: { error?: string } = {};
  try {
    payload = await res.json() as { error?: string };
  } catch {
    // Keep the generic error below when an intermediary returns non-JSON.
  }
  throw new ContactSubmissionError(payload.error ?? 'Could not send the message');
}
