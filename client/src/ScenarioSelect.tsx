import { useMemo, useState, type ReactNode } from 'react';
import type { ProgressData } from './api';
import type { LeaderboardEntry, Scenario, SeriesDefinition, SeriesLeaderboardEntry } from './types';
import './ScenarioSelect.css';

const LOCAL_SCORE_KEY = 'bbt.localScores.v1';
const SERIES_SCORE_KEY = 'series';

type LocalScoreMap = Record<string, string[]>;
type PlayView = 'series' | 'individual';

interface ScenarioProgress {
  played: boolean;
  bestPercent: number | null;
  rank: number | null;
  entries: number;
}

interface Props {
  scenarios: Scenario[];
  series: SeriesDefinition;
  onPlay: (scenario: Scenario) => void;
  onLeaderboard: (scenario: Scenario) => void;
  onStartSeries: () => void;
  onSeriesLeaderboard: () => void;
  onAdmin: () => void;
  /** Fetched once by App in a single request; undefined while it is in flight. */
  progress?: ProgressData;
  userId?: string;
  isAdmin: boolean;
  userMenu: ReactNode;
  reportButton: ReactNode;
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function readLocalScores(): LocalScoreMap {
  try {
    const raw = window.localStorage.getItem(LOCAL_SCORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? parsed as LocalScoreMap : {};
  } catch {
    return {};
  }
}

function progressFromEntries(
  entries: LeaderboardEntry[] | SeriesLeaderboardEntry[],
  localIds: string[] = [],
  userId?: string,
): ScenarioProgress {
  const localIdSet = new Set(localIds);
  let bestPercent: number | null = null;
  let bestRank: number | null = null;

  entries.forEach((entry, index) => {
    if (!localIdSet.has(entry.id) && entry.userId !== userId) return;
    if (bestPercent === null || entry.probability > bestPercent) {
      bestPercent = entry.probability;
      bestRank = index + 1;
    }
  });

  return {
    played: bestPercent !== null,
    bestPercent,
    rank: bestRank,
    entries: entries.length,
  };
}

function formatProgress(progress?: ScenarioProgress): string {
  if (!progress) return 'Checking history...';
  if (!progress.played) {
    return progress.entries > 0 ? `Not played, ${progress.entries} ranked` : 'Not played';
  }
  // Rank is only meaningful while the entry is inside the returned top slice.
  // Outside it we still know the player's own best, so show that alone rather
  // than an invented position.
  return progress.rank === null
    ? `Best ${pct(progress.bestPercent ?? 0)}`
    : `Best ${pct(progress.bestPercent ?? 0)}, Rank #${progress.rank}`;
}

export function ScenarioSelect({
  scenarios,
  series,
  onPlay,
  onLeaderboard,
  onStartSeries,
  onSeriesLeaderboard,
  onAdmin,
  progress,
  userId,
  isAdmin,
  userMenu,
  reportButton,
}: Props) {
  const [playView, setPlayView] = useState<PlayView>('series');

  // Read storage once per mount, not on every render — as a plain call this was
  // a fresh object identity each time, which defeated both memos below.
  const localScores = useMemo(() => readLocalScores(), []);

  const scenarioProgress = useMemo(() => {
    const leaderboards: Record<string, LeaderboardEntry[]> = progress?.scenarios ?? {};
    return Object.fromEntries(
      scenarios.map(scenario => [
        scenario.id,
        progressFromEntries(leaderboards[scenario.id] ?? [], localScores[scenario.id], userId),
      ]),
    ) as Record<string, ScenarioProgress>;
  }, [scenarios, progress, localScores, userId]);

  const seriesProgress = useMemo(() => {
    const seriesLeaderboard: SeriesLeaderboardEntry[] = progress?.series ?? [];
    return progressFromEntries(seriesLeaderboard, localScores[SERIES_SCORE_KEY], userId);
  }, [progress, localScores, userId]);

  return (
    <div className="scenario-select">
      <div className="scenario-select__header">
        <div className="scenario-select__brand">
          <span className="scenario-select__eyebrow">The final turn: Do or die</span>
          <h1 className="scenario-select__title">Turn 16</h1>
          <p className="scenario-select__subtitle">Pray to Nuffle</p>
        </div>
        <div className="scenario-select__user">
          <div className="scenario-select__controls">
            {reportButton}
            {userMenu}
          </div>
        </div>
        <div className="scenario-select__route" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="play-switch" role="tablist" aria-label="Play mode">
        <button
          className={`play-switch__tab${playView === 'series' ? ' play-switch__tab--active' : ''}`}
          type="button"
          role="tab"
          aria-selected={playView === 'series'}
          onClick={() => setPlayView('series')}
        >
          Series
        </button>
        <button
          className={`play-switch__tab${playView === 'individual' ? ' play-switch__tab--active' : ''}`}
          type="button"
          role="tab"
          aria-selected={playView === 'individual'}
          onClick={() => setPlayView('individual')}
        >
          Single Plays
        </button>
        {isAdmin && (
          <button
            className="play-switch__tab"
            type="button"
            role="tab"
            aria-selected="false"
            onClick={onAdmin}
          >
            Puzzle Creator
          </button>
        )}
      </div>

      {playView === 'series' ? (
        <section className="play-section">
          <div className="series-row">
            <div className="series-row__number" aria-hidden="true">01</div>
            <div className="series-row__body">
              <span className="series-row__eyebrow">Tutorial</span>
              <h2 className="series-row__title">{series.name}</h2>
              <p className="series-row__desc">{series.description}</p>
              <div className="series-row__meta">{formatProgress(seriesProgress)}</div>
            </div>
            <div className="series-row__actions">
              <button className="btn btn--primary" onClick={onStartSeries}>
                Start Series
              </button>
              <button className="btn btn--secondary" onClick={onSeriesLeaderboard}>
                Rankings
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="play-section">
          <div className="challenge-section__header">
            <div>
              <h2 className="challenge-section__title">Single Plays</h2>
              <p className="challenge-section__subtitle">Choose a ranked board.</p>
            </div>
          </div>

          <div className="challenge-tile-grid">
            {scenarios.map((s, index) => {
              return (
                <div key={s.id} className="challenge-tile">
                  <div className="challenge-tile__index" aria-hidden="true">
                    Play {String(index + 1).padStart(2, '0')}
                  </div>
                  <div className="challenge-tile__body">
                    <div className="challenge-tile__name">{s.name}</div>
                    <div className="challenge-tile__desc">{s.description}</div>
                    <div className="challenge-tile__meta">{formatProgress(scenarioProgress[s.id])}</div>
                  </div>
                  <div className="challenge-tile__actions">
                    <button className="btn btn--primary" onClick={() => onPlay(s)}>
                      Play
                    </button>
                    <button className="btn btn--secondary" onClick={() => onLeaderboard(s)}>
                      Rankings
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
