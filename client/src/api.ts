import type { LeaderboardEntry, RiskyMove, SeriesLeaderboardEntry, SeriesPuzzleResult } from './types';

const BASE = '/api';

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
): Promise<LeaderboardEntry> {
  const res = await fetch(`${BASE}/leaderboard/${scenarioId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
): Promise<SeriesLeaderboardEntry> {
  const res = await fetch(`${BASE}/series-leaderboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, probability, diceCount, puzzles }),
  });
  if (!res.ok) throw new Error('Failed to submit series score');
  return res.json();
}
