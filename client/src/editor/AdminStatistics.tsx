import { useCallback, useEffect, useState } from 'react';
import type { PerformanceSummary, PlayerStatistics } from '../../../shared/statistics.js';
import { fetchPlayerStatistics } from './editorApi';
import { AdminAnalytics } from './AdminAnalytics';
import { AdminLogins } from './AdminLogins';
import './AdminStatistics.css';
import './AdminAnalytics.css';

type PuzzleSortKey = 'name' | 'players' | 'average' | 'median' | 'best' | 'dice' | 'latest';
type SortDirection = 'ascending' | 'descending';

interface Props {
  idToken: string | null;
  onBack: () => void;
}

function formatPercent(value: number | null): string {
  return value === null ? 'N/A' : `${(value * 100).toFixed(1)}%`;
}

function formatDice(value: number | null): string {
  return value === null ? 'N/A' : value.toFixed(1);
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

function sortValue(summary: PerformanceSummary, key: PuzzleSortKey): number | string | null {
  switch (key) {
    case 'name': return null;
    case 'players': return summary.recordedPlayers;
    case 'average': return summary.averageProbability;
    case 'median': return summary.medianProbability;
    case 'best': return summary.bestProbability;
    case 'dice': return summary.averageDiceCount;
    case 'latest': return summary.latestScoreAt ? Date.parse(summary.latestScoreAt) : null;
  }
}

function escapeCsv(value: string | number | null): string {
  const text = value === null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadStatisticsCsv(statistics: PlayerStatistics): void {
  const header = ['Puzzle', 'Scenario ID', 'Recorded players', 'Personal bests', 'Average probability', 'Median probability', 'Best probability', 'Average dice', 'Latest score'];
  const rows = statistics.puzzles.map(puzzle => [
    puzzle.scenarioName, puzzle.scenarioId, puzzle.recordedPlayers, puzzle.personalBests,
    puzzle.averageProbability, puzzle.medianProbability, puzzle.bestProbability,
    puzzle.averageDiceCount, puzzle.latestScoreAt,
  ]);
  const csv = [header, ...rows].map(row => row.map(escapeCsv).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'turn-16-puzzle-statistics.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export function AdminStatistics({ idToken, onBack }: Props) {
  const [statistics, setStatistics] = useState<PlayerStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<PuzzleSortKey>('average');
  const [sortDirection, setSortDirection] = useState<SortDirection>('descending');
  const [windowDays, setWindowDays] = useState<7 | 30 | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStatistics(await fetchPlayerStatistics(idToken, windowDays ?? undefined));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load statistics.');
    } finally {
      setLoading(false);
    }
  }, [idToken, windowDays]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const windowLabel = windowDays === null ? 'All retained bests' : `Last ${windowDays} days`;

  const toggleSort = (nextKey: PuzzleSortKey) => {
    if (nextKey === sortKey) {
      setSortDirection(direction => direction === 'ascending' ? 'descending' : 'ascending');
    } else {
      setSortKey(nextKey);
      setSortDirection(nextKey === 'name' ? 'ascending' : 'descending');
    }
  };

  const filteredPuzzles = statistics?.puzzles
    .filter(puzzle => `${puzzle.scenarioName} ${puzzle.scenarioId}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((left, right) => {
      if (sortKey === 'name') {
        return sortDirection === 'ascending'
          ? left.scenarioName.localeCompare(right.scenarioName)
          : right.scenarioName.localeCompare(left.scenarioName);
      }
      const leftValue = sortValue(left, sortKey);
      const rightValue = sortValue(right, sortKey);
      if (leftValue === null && rightValue === null) return left.scenarioName.localeCompare(right.scenarioName);
      if (leftValue === null) return 1;
      if (rightValue === null) return -1;
      return sortDirection === 'ascending'
        ? Number(leftValue) - Number(rightValue)
        : Number(rightValue) - Number(leftValue);
    }) ?? [];

  return (
    <section className="admin-statistics">
      <header className="editor__header admin-statistics__header">
        <div>
          <h1 className="editor__title">Statistics</h1>
          <p className="editor__subtitle">
            Anonymous player-performance summaries from {windowLabel.toLocaleLowerCase()}.
          </p>
        </div>
        <div className="editor__header-actions">
          <button className="btn btn--secondary" onClick={onBack}>Back</button>
          <button className="btn btn--primary" disabled={loading} onClick={() => { void load(); }}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </header>

      <div className="admin-statistics__notice">
        Leaderboards retain one personal best per player. These figures are not attempt counts or completion rates,
        and no player names or move histories are included.
      </div>

      <AdminAnalytics idToken={idToken} />

      {error && (
        <div className="admin-statistics__error" role="alert">
          <p>{error}</p>
          <button className="btn btn--secondary" onClick={() => { void load(); }}>Try Again</button>
        </div>
      )}

      {loading && !statistics && <p className="admin-statistics__status" role="status">Loading player statistics...</p>}

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

          <div className="admin-statistics__window" role="group" aria-label="Statistics period">
            {([null, 30, 7] as const).map(days => <button
              key={days ?? 'all'}
              className={`btn btn--secondary${windowDays === days ? ' admin-statistics__window--active' : ''}`}
              aria-pressed={windowDays === days}
              onClick={() => setWindowDays(days)}
            >{days === null ? 'All time' : `${days} days`}</button>)}
            <span>Showing {windowLabel.toLocaleLowerCase()}.</span>
          </div>

          <section className="admin-statistics__panel">
            <div className="admin-statistics__panel-heading">
              <div>
                <h2>Puzzle Performance</h2>
                <p>Probability and dice figures summarize each puzzle’s {windowLabel.toLocaleLowerCase()}.</p>
              </div>
              <span>Updated {formatDate(statistics.generatedAt)}</span>
            </div>
            <div className="admin-statistics__tools">
              <label>
                <span>Find puzzle</span>
                <input
                  type="search"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Name or scenario ID"
                />
              </label>
              <span>{filteredPuzzles.length} of {statistics.puzzles.length} puzzles</span>
              <button className="btn btn--secondary" onClick={() => downloadStatisticsCsv(statistics)}>
                Download CSV
              </button>
            </div>
            <div className="admin-statistics__table-wrap">
              <table className="admin-statistics__table">
                <thead>
                  <tr>
                    {([
                      ['name', 'Puzzle'], ['players', 'Players'], ['average', 'Average'], ['median', 'Median'],
                      ['best', 'Best'], ['dice', 'Avg. Dice'], ['latest', 'Latest Score'],
                    ] as const).map(([key, label]) => (
                      <th key={key} scope="col" aria-sort={sortKey === key ? sortDirection : 'none'}>
                        <button className="admin-statistics__sort" onClick={() => toggleSort(key)}>
                          {label}{sortKey === key ? (sortDirection === 'ascending' ? ' ↑' : ' ↓') : ''}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPuzzles.map(puzzle => (
                    <tr key={puzzle.scenarioId}>
                      <th scope="row">
                        <strong>{puzzle.scenarioName}</strong>
                        <span>{puzzle.scenarioId}</span>
                      </th>
                      <PerformanceCells summary={puzzle} />
                    </tr>
                  ))}
                  {filteredPuzzles.length === 0 && (
                    <tr><td colSpan={7} className="admin-statistics__empty">No puzzle statistics match that search.</td></tr>
                  )}
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

          <section className="admin-statistics__panel admin-statistics__series">
            <div className="admin-statistics__panel-heading">
              <div>
                <h2>Player Habits</h2>
                <p>Anonymous patterns from retained puzzle personal bests; these are not all attempts.</p>
              </div>
            </div>
            <dl className="admin-statistics__series-grid">
              <div><dt>Signed in</dt><dd>{statistics.habits?.signedInPlayers ?? 0}</dd></div>
              <div><dt>Guests</dt><dd>{statistics.habits?.guestPlayers ?? 0}</dd></div>
              <div><dt>Returning players</dt><dd>{statistics.habits?.returningPlayers ?? 0}</dd></div>
              <div><dt>Avg. puzzles/player</dt><dd>{formatDice(statistics.habits?.averagePuzzlesPerPlayer ?? null)}</dd></div>
              <div><dt>Active, 7 days</dt><dd>{statistics.habits?.activePlayers7Days ?? 0}</dd></div>
              <div><dt>Active, 30 days</dt><dd>{statistics.habits?.activePlayers30Days ?? 0}</dd></div>
              <div><dt>One puzzle</dt><dd>{statistics.habits?.onePuzzlePlayers ?? 0}</dd></div>
              <div><dt>Three+ puzzles</dt><dd>{statistics.habits?.threePlusPuzzlePlayers ?? 0}</dd></div>
              {Object.entries(statistics.habits?.actionCounts ?? {}).map(([action, count]) => (
                <div key={action}><dt>{action}</dt><dd>{count}</dd></div>
              ))}
            </dl>
          </section>

          <AdminLogins idToken={idToken} />
        </>
      )}
    </section>
  );
}
