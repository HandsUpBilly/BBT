import { useCallback, useEffect, useState } from 'react';
import type { EngagementAnalytics } from '../../../shared/analyticsStatistics.js';
import { fetchEngagementAnalytics } from './editorApi';

interface Props { idToken: string | null }
type WindowDays = 7 | 30 | 90 | 365;

function number(value: number | null, digits = 0): string {
  return value === null ? 'N/A' : value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function percent(value: number | null): string {
  return value === null ? 'N/A' : `${(value * 100).toFixed(1)}%`;
}

function duration(seconds: number | null): string {
  if (seconds === null) return 'N/A';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${(seconds / 60).toFixed(1)}m`;
}

function label(value: string): string {
  return value.replaceAll('-', ' ').replace(/\b\w/g, character => character.toUpperCase());
}

function puzzleCounterRows(
  puzzles: EngagementAnalytics['puzzles'],
  key: 'stopDepth' | 'lastActions',
): Array<{ name: string; count: number }> {
  const counts: Record<string, number> = {};
  puzzles.forEach(puzzle => Object.entries(puzzle[key]).forEach(([name, count]) => {
    counts[name] = (counts[name] ?? 0) + count;
  }));
  return Object.entries(counts).map(([name, count]) => ({ name, count }));
}

function Bars({ rows, valueKey = 'count' }: { rows: Array<Record<string, string | number | null>>; valueKey?: string }) {
  const maximum = Math.max(1, ...rows.map(row => Number(row[valueKey]) || 0));
  return (
    <div className="admin-analytics__bars">
      {rows.map(row => {
        const name = String(row.stage ?? row.label ?? row.name ?? row.value);
        const value = Number(row[valueKey]) || 0;
        return (
          <div className="admin-analytics__bar" key={name}>
            <span>{label(name)}</span>
            <span className="admin-analytics__bar-track" aria-hidden="true">
              <span style={{ width: `${value / maximum * 100}%` }} />
            </span>
            <strong>{value.toLocaleString()}</strong>
          </div>
        );
      })}
    </div>
  );
}

function Trend({ rows }: { rows: EngagementAnalytics['trend'] }) {
  const width = 720;
  const height = 180;
  const maximum = Math.max(1, ...rows.flatMap(row => [row.starts, row.completions]));
  const points = (key: 'starts' | 'completions') => rows.map((row, index) => {
    const x = rows.length <= 1 ? 0 : index / (rows.length - 1) * width;
    const y = height - row[key] / maximum * (height - 12);
    return `${x},${y}`;
  }).join(' ');
  return (
    <figure className="admin-analytics__trend">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Game activity trend with ${rows.reduce((sum, row) => sum + row.starts, 0)} puzzle starts and ${rows.reduce((sum, row) => sum + row.completions, 0)} completions`}>
        <polyline className="admin-analytics__line admin-analytics__line--starts" points={points('starts')} />
        <polyline className="admin-analytics__line admin-analytics__line--completions" points={points('completions')} />
      </svg>
      <figcaption><span>Puzzle Starts</span><span>Completions</span></figcaption>
      <details>
        <summary>Exact daily values</summary>
        <div className="admin-statistics__table-wrap">
          <table className="admin-statistics__table admin-analytics__daily-table">
            <thead><tr><th>Date</th><th>Game Sessions</th><th>Engaged</th><th>Starts</th><th>Completions</th></tr></thead>
            <tbody>{rows.map(row => <tr key={row.date}><th>{row.date}</th><td>{row.gameSessions}</td><td>{row.engagedSessions}</td><td>{row.starts}</td><td>{row.completions}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

export function AdminAnalytics({ idToken }: Props) {
  const [windowDays, setWindowDays] = useState<WindowDays>(30);
  const [analytics, setAnalytics] = useState<EngagementAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try { setAnalytics(await fetchEngagementAnalytics(idToken, windowDays)); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Could not load engagement analytics.'); }
    finally { setLoading(false); }
  }, [idToken, windowDays]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  return (
    <section className="admin-analytics" aria-labelledby="engagement-title">
      <div className="admin-statistics__panel-heading admin-analytics__heading">
        <div>
          <h2 id="engagement-title">Engagement</h2>
          <p>Anonymous puzzle play, completion, and drop-off statistics.</p>
        </div>
        <button className="btn btn--secondary" disabled={loading} onClick={() => { void load(); }}>{loading ? 'Loading...' : 'Refresh'}</button>
      </div>
      <div className="admin-statistics__notice">
        This first-party dashboard deliberately does not collect traffic, acquisition, device, browser, or location data.
        Open attempts become inferred inactive/closed after 30 minutes. Game-session detail is retained for 13 months.
      </div>
      <div className="admin-statistics__window" role="group" aria-label="Engagement period">
        {([7, 30, 90, 365] as const).map(days => <button
          key={days} className={`btn btn--secondary${windowDays === days ? ' admin-statistics__window--active' : ''}`}
          aria-pressed={windowDays === days} onClick={() => setWindowDays(days)}>{days} days</button>)}
      </div>
      {error && <div className="admin-statistics__error" role="alert"><p>{error}</p><button className="btn btn--secondary" onClick={() => { void load(); }}>Try Again</button></div>}
      {!analytics && loading && <p className="admin-statistics__status" role="status">Loading engagement analytics...</p>}
      {analytics && (
        <>
          <div className="admin-statistics__cards admin-analytics__cards" aria-label="Engagement summary">
            {[
              ['Game Sessions', number(analytics.overview.gameSessions)],
              ['Engaged Sessions', number(analytics.overview.engagedSessions)],
              ['Puzzle Starts', number(analytics.overview.puzzleStarts)],
              ['Completions', number(analytics.overview.puzzleCompletions)],
              ['Completion Rate', percent(analytics.overview.completionRate)],
              ['Median Active Time', duration(analytics.overview.medianActiveSeconds)],
            ].map(([name, value]) => <article className="admin-statistics__card" key={name}><span>{name}</span><strong>{value}</strong><small>Last {windowDays} days</small></article>)}
          </div>

          <section className="admin-statistics__panel">
            <div className="admin-statistics__panel-heading"><div><h2>Starts and Completion Trend</h2><p>{analytics.periodStart.slice(0, 10)} to {analytics.periodEnd.slice(0, 10)} UTC</p></div></div>
            <Trend rows={analytics.trend} />
          </section>

          <div className="admin-analytics__two-column">
            <section className="admin-statistics__panel admin-analytics__padded"><h2>Attempt Funnel</h2><Bars rows={analytics.funnel} /></section>
            <section className="admin-statistics__panel admin-analytics__padded"><h2>Active Time</h2><Bars rows={analytics.activeTimeDistribution} /></section>
            <section className="admin-statistics__panel admin-analytics__padded"><h2>Puzzles per Game Session</h2><Bars rows={analytics.puzzlesPerSessionDistribution} /></section>
          </div>

          <section className="admin-statistics__panel">
            <div className="admin-statistics__panel-heading"><div><h2>Puzzle Drop-off</h2><p>Starts, meaningful play, completion, restart, leave, and inferred inactivity.</p></div></div>
            <div className="admin-statistics__table-wrap">
              <table className="admin-statistics__table admin-analytics__puzzle-table">
                <thead><tr><th>Puzzle</th><th>Starts</th><th>Engaged</th><th>Completed</th><th>Rate</th><th>Restarts</th><th>Leaves</th><th>Inactive</th><th>Median Time</th></tr></thead>
                <tbody>{analytics.puzzles.map(puzzle => <tr key={puzzle.scenarioId}>
                  <th><strong>{puzzle.scenarioName}</strong><span>{puzzle.scenarioId}</span></th>
                  <td>{puzzle.starts}</td><td>{puzzle.engaged}</td><td>{puzzle.completions}</td><td>{percent(puzzle.completionRate)}</td>
                  <td>{puzzle.restarts}</td><td>{puzzle.explicitLeaves}</td><td>{puzzle.inactive}</td><td>{duration(puzzle.medianActiveSeconds)}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </section>

          <div className="admin-analytics__two-column">
            <section className="admin-statistics__panel admin-analytics__padded"><h2>Incomplete Attempt Depth</h2><Bars rows={puzzleCounterRows(analytics.puzzles, 'stopDepth')} /></section>
            <section className="admin-statistics__panel admin-analytics__padded"><h2>Last Action Before Stop</h2><Bars rows={puzzleCounterRows(analytics.puzzles, 'lastActions')} /></section>
          </div>

          <div className="admin-analytics__two-column">
            <section className="admin-statistics__panel admin-analytics__padded"><h2>Gameplay Actions</h2><Bars rows={analytics.actions} /></section>
            <section className="admin-statistics__panel admin-analytics__padded"><h2>Attempt Outcomes</h2><Bars rows={analytics.outcomes} /></section>
          </div>

          <section className="admin-statistics__panel admin-analytics__padded">
            <h2>Tutorial Funnel</h2>
            <Bars rows={[
              { stage: 'Series Starts', count: analytics.seriesFunnel.starts },
              ...analytics.seriesFunnel.stages.map(stage => ({ stage: `Puzzle ${stage.position}: ${stage.scenarioId}`, count: stage.completions })),
              { stage: 'Series Completed', count: analytics.seriesFunnel.completions },
            ]} />
          </section>

          <section className="admin-statistics__panel admin-analytics__padded"><h2>Interactions</h2><Bars rows={analytics.interactions.slice(0, 20)} /></section>
        </>
      )}
    </section>
  );
}
