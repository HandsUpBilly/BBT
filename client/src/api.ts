import type { LeaderboardEntry, RiskyMove, SeriesLeaderboardEntry, SeriesPuzzleResult } from './types';

const BASE = '/api';

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

export class ReportSubmissionError extends Error {
  readonly download?: ReportDownload;

  constructor(message: string, download?: ReportDownload) {
    super(message);
    this.name = 'ReportSubmissionError';
    this.download = download;
  }
}

export async function fetchLeaderboard(scenarioId: string): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${BASE}/leaderboard/${scenarioId}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}${body ? `: ${body}` : ''}`);
  }
  return res.json();
}

export async function submitScore(
  scenarioId: string,
  name: string,
  probability: number,
  diceCount: number,
  moves: RiskyMove[],
  idToken?: string | null,
): Promise<LeaderboardEntry> {
  const res = await fetch(`${BASE}/leaderboard/${scenarioId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({ name, probability, diceCount, moves }),
  });
  if (!res.ok) throw new Error('Failed to submit score');
  return res.json();
}

export async function fetchSeriesLeaderboard(): Promise<SeriesLeaderboardEntry[]> {
  const res = await fetch(`${BASE}/series-leaderboard`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}${body ? `: ${body}` : ''}`);
  }
  return res.json();
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
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({ name, probability, diceCount, puzzles }),
  });
  if (!res.ok) throw new Error('Failed to submit series score');
  return res.json();
}

function escapeMarkdown(value: string): string {
  return value
    .trim()
    .replace(/\\/g, '\\\\')
    .replace(/([`*_{}[\]<>#+!|-])/g, '\\$1');
}

/** Used only if the request never reaches the server, so the player can still
 * save a report that matches the server-created issue layout. */
export function createReportDownload(input: ReportInput): ReportDownload {
  const category = input.type === 'feature' ? 'Feature request' : 'Issue';
  const titlePrefix = input.type === 'feature' ? '[Feature]' : '[Issue]';
  const context = [
    ['Submitted', new Date().toISOString()],
    ['App mode', input.context.mode],
    ['Scenario', input.context.scenarioName],
    ['Scenario ID', input.context.scenarioId],
    ['Build', input.context.appVersion],
    ['Browser', input.context.userAgent],
  ].filter(([, value]) => Boolean(value))
    .map(([label, value]) => `- ${label}: ${escapeMarkdown(String(value))}`);
  const title = `${titlePrefix} ${input.title.trim().replace(/\s+/g, ' ')}`;
  const body = [
    '## Report details',
    '',
    `- Type: ${category}`,
    `- Reporter: ${escapeMarkdown(input.reporterName)}`,
    '',
    '## Description',
    '',
    escapeMarkdown(input.description),
    '',
    '## Context',
    '',
    ...context,
  ].join('\n');
  const date = new Date().toISOString().slice(0, 10);
  return { fileName: `bbt-${input.type}-${date}.md`, content: `# ${title}\n\n${body}\n` };
}

export async function submitReport(input: ReportInput, idToken?: string | null): Promise<ReportSubmission> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
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
