import { useCallback, useEffect, useState } from 'react';
import { fetchLeaderboard } from './api';
import { AttemptHistory } from './AttemptHistory';
import type { LeaderboardEntry, Scenario } from './types';

import './Leaderboard.css';

interface Props {
  scenario: Scenario;
  onBack: () => void;
  highlightId?: string;
  initialEntries?: LeaderboardEntry[];
  onEntriesLoaded?: (entries: LeaderboardEntry[]) => void;
  onRowClick?: (entry: LeaderboardEntry) => void;
}

function pct(p: number) { return `${Math.round(p * 100)}%`; }

function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase();
}

/**
 * A branching run's dice count is a weight-weighted mean over the branches that
 * score, so it is not a whole number. Single-line runs stay integral and are
 * shown unchanged.
 */
function formatDiceCount(diceCount: number): string {
  return Number.isInteger(diceCount) ? String(diceCount) : diceCount.toFixed(1);
}

export function Leaderboard({ scenario, onBack, highlightId, initialEntries, onEntriesLoaded, onRowClick }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>(initialEntries ?? []);
  const [loading, setLoading] = useState(!initialEntries);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLeaderboard(scenario.id);
      setEntries(data);
      onEntriesLoaded?.(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Load failed: ${msg} [${scenario.id}]`);
    } finally {
      setLoading(false);
    }
  }, [scenario.id, onEntriesLoaded]);

  useEffect(() => {
    if (initialEntries) return;
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [initialEntries, load]);

  return (
    <div className="leaderboard">
      <div className="leaderboard__header">
        <button className="lb-back-btn" onClick={onBack}>← Back</button>
        <div>
          <h2 className="leaderboard__title">{scenario.name}</h2>
          <p className="leaderboard__subtitle">Top plays by success probability</p>
        </div>
        <button className="lb-reload-btn" onClick={load} disabled={loading} title="Reload">
          {loading ? '…' : '↻'}
        </button>
      </div>

      {loading && <div className="leaderboard__state">Loading…</div>}
      {error   && <div className="leaderboard__state leaderboard__state--error">{error}</div>}

      {!loading && !error && entries.length === 0 && (
        <div className="leaderboard__state">No scores yet — be the first!</div>
      )}

      {!loading && !error && entries.length > 0 && (
        <table className="lb-table">
          <thead>
            <tr>
              <th>#</th>
              <th></th>
              <th>Name</th>
              <th>Probability</th>
              <th>Dice rolls</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr
                key={e.id}
                className={[
                  e.id === highlightId ? 'lb-table__row--highlight' : '',
                  onRowClick ? 'lb-table__row--clickable' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => onRowClick?.(e)}
              >
                <td className="lb-table__rank">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </td>
                <td className="lb-table__avatar-cell">
                  <span className="lb-table__avatar lb-table__avatar--fallback">{initials(e.name)}</span>
                </td>
                <td className="lb-table__name">{e.name}</td>
                <td className="lb-table__prob">{pct(e.probability)}</td>
                <td className="lb-table__dice">{formatDiceCount(e.diceCount)}</td>
                <td className="lb-table__date">{new Date(e.date).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* The board is personal bests only, so it can't answer "am I getting
          better at this?" — that needs the runs a best replaced. It sits here
          rather than behind its own route because this screen is already
          "everything about my standing at this puzzle". */}
      <AttemptHistory key={scenario.id} scenarioId={scenario.id} />
    </div>
  );
}
