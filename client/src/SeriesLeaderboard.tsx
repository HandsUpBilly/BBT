import { useCallback, useEffect, useState } from 'react';
import { fetchSeriesLeaderboard } from './api';
import type { SeriesLeaderboardEntry } from './types';

import './Leaderboard.css';

interface Props {
  onBack: () => void;
  highlightId?: string;
  initialEntries?: SeriesLeaderboardEntry[];
  onEntriesLoaded?: (entries: SeriesLeaderboardEntry[]) => void;
  onRowClick?: (entry: SeriesLeaderboardEntry) => void;
}

function pct(p: number) { return `${Math.round(p * 100)}%`; }

export function SeriesLeaderboard({ onBack, highlightId, initialEntries, onEntriesLoaded, onRowClick }: Props) {
  const [entries, setEntries] = useState<SeriesLeaderboardEntry[]>(initialEntries ?? []);
  const [loading, setLoading] = useState(!initialEntries);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSeriesLeaderboard();
      setEntries(data);
      onEntriesLoaded?.(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Load failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [onEntriesLoaded]);

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
          <h2 className="leaderboard__title">Series Leaderboard</h2>
          <p className="leaderboard__subtitle">Top runs by average success probability across all puzzles</p>
        </div>
        <button className="lb-reload-btn" onClick={load} disabled={loading} title="Reload">
          {loading ? '…' : '↻'}
        </button>
      </div>

      {loading && <div className="leaderboard__state">Loading…</div>}
      {error   && <div className="leaderboard__state leaderboard__state--error">{error}</div>}

      {!loading && !error && entries.length === 0 && (
        <div className="leaderboard__state">No series runs yet — be the first!</div>
      )}

      {!loading && !error && entries.length > 0 && (
        <table className="lb-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Avg. Probability</th>
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
                <td className="lb-table__name">{e.name}</td>
                <td className="lb-table__prob">{pct(e.probability)}</td>
                <td className="lb-table__dice">{e.diceCount}</td>
                <td className="lb-table__date">{new Date(e.date).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
