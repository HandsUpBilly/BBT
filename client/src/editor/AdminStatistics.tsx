import { useCallback, useEffect, useState } from 'react';
import type { PerformanceSummary, PlayerStatistics } from '../../../shared/statistics.js';
import { fetchPlayerStatistics } from './editorApi';
import './AdminStatistics.css';

interface Props {
  idToken: string | null;
  onBack: () => void;
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${(value * 100).toFixed(1)}%`;
}

function formatDice(value: number | null): string {
  return value === null ? '—' : value.toFixed(1);
}

function formatDate(value: string | null): string {
  if (!value) return 'No scores yet';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
}

function PerformanceCells({ summary }: { summary: PerformanceSummary }) {
  return (
    <>
      <td>{summary.recordedPlayers}</td>
      <td>{formatPercent(summary.averageProbability)}</td>
      <td>{formatPercent(summary.medianProbability)}</td>
      <td>{formatPercent(summary.bestProbability)}</td>
      <td>{formatDice(summary.averageDiceCount)}</td>
      <td>{formatDate(summary.latestScoreAt)}</td>
    </>
  );
}

export function AdminStatistics({ idToken, onBack }: Props) {
  const [statistics, setStatistics] = useState<PlayerStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStatistics(await fetchPlayerStatistics(idToken));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load statistics.');
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <section className="admin-statistics">
      <header className="editor__header admin-statistics__header">
        <div>
          <h1 className="editor__title">Statistics</h1>
          <p className="editor__subtitle">
            Anonymous player-performance summaries from retained personal-best scores.
          </p>
        </div>
        <div className="editor__header-actions">
          <button className="btn btn--secondary" onClick={onBack}>Back</button>
          <button className="btn btn--primary" disabled={loading} onClick={() => { void load(); }}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </header>

      <div className="admin-statistics__notice">
        Leaderboards retain one personal best per player. These figures are not attempt counts or completion rates,
        and no player names or move histories are included.
      </div>

      {error && (
        <div className="admin-statistics__error" role="alert">
          <p>{error}</p>
          <button className="btn btn--secondary" onClick={() => { void load(); }}>Try Again</button>
        </div>
      )}

      {loading && !statistics && <p className="admin-statistics__status" role="status">Loading player statistics…</p>}

      {statistics && (
        <>
          <div className="admin-statistics__cards" aria-label="Performance summary">
            <article className="admin-statistics__card">
              <span>Recorded Players</span>
              <strong>{statistics.totals.recordedPlayers}</strong>
              <small>Deduplicated across puzzles and series</small>
            </article>
            <article className="admin-statistics__card">
              <span>Puzzle Personal Bests</span>
              <strong>{statistics.totals.puzzlePersonalBests}</strong>
              <small>One retained score per player and puzzle</small>
            </article>
            <article className="admin-statistics__card">
              <span>Average Best Chance</span>
              <strong>{formatPercent(statistics.totals.averageProbability)}</strong>
              <small>Across all puzzle personal bests</small>
            </article>
            <article className="admin-statistics__card">
              <span>Series Finishers</span>
              <strong>{statistics.totals.seriesPersonalBests}</strong>
              <small>Recorded series personal bests</small>
            </article>
          </div>

          <section className="admin-statistics__panel">
            <div className="admin-statistics__panel-heading">
              <div>
                <h2>Puzzle Performance</h2>
                <p>Probability and dice figures summarize each puzzle's retained personal bests.</p>
              </div>
              <span>Updated {formatDate(statistics.generatedAt)}</span>
            </div>
            <div className="admin-statistics__table-wrap">
              <table className="admin-statistics__table">
                <thead>
                  <tr>
                    <th scope="col">Puzzle</th>
                    <th scope="col">Players</th>
                    <th scope="col">Average</th>
                    <th scope="col">Median</th>
                    <th scope="col">Best</th>
                    <th scope="col">Avg. Dice</th>
                    <th scope="col">Latest Score</th>
                  </tr>
                </thead>
                <tbody>
                  {statistics.puzzles.map(puzzle => (
                    <tr key={puzzle.scenarioId}>
                      <th scope="row">
                        <strong>{puzzle.scenarioName}</strong>
                        <span>{puzzle.scenarioId}</span>
                      </th>
                      <PerformanceCells summary={puzzle} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="admin-statistics__panel admin-statistics__series">
            <div className="admin-statistics__panel-heading">
              <div>
                <h2>Series Performance</h2>
                <p>Completed full-series personal bests.</p>
              </div>
            </div>
            <dl className="admin-statistics__series-grid">
              <div><dt>Players</dt><dd>{statistics.series.recordedPlayers}</dd></div>
              <div><dt>Average</dt><dd>{formatPercent(statistics.series.averageProbability)}</dd></div>
              <div><dt>Median</dt><dd>{formatPercent(statistics.series.medianProbability)}</dd></div>
              <div><dt>Best</dt><dd>{formatPercent(statistics.series.bestProbability)}</dd></div>
              <div><dt>Average Dice</dt><dd>{formatDice(statistics.series.averageDiceCount)}</dd></div>
              <div><dt>Latest Score</dt><dd>{formatDate(statistics.series.latestScoreAt)}</dd></div>
            </dl>
          </section>
        </>
      )}
    </section>
  );
}
