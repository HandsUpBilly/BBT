import { useMemo, useState, type ReactNode } from 'react';
import type { ProgressData } from './api';
import type { LeaderboardEntry, Scenario, SeriesDefinition, SeriesLeaderboardEntry } from './types';
import nuffleShuffleLogo from './assets/series/nuffle-shuffle.webp';
import matchdayClash from './assets/matchday-clash.webp';
import { FREE_PLAY_SCENARIO_ID } from './tutorialLessons';
import { UI_COPY } from './uiCopy';
import './ScenarioSelect.css';

const LOCAL_SCORE_KEY = 'bbt.localScores.v1';
const SERIES_SCORE_KEY = 'series';

type LocalScoreMap = Record<string, string[]>;
type PlayView = 'series' | 'individual';

const SERIES_LOGOS: Record<string, string> = {
  'nuffle-shuffle': nuffleShuffleLogo,
};

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
  if (!progress) return UI_COPY.landing.checkingHistory;
  if (!progress.played) {
    return progress.entries > 0
      ? UI_COPY.landing.notPlayedRanked(progress.entries)
      : UI_COPY.landing.notPlayed;
  }
  // Rank is only meaningful while the entry is inside the returned top slice.
  // Outside it we still know the player's own best, so show that alone rather
  // than an invented position.
  return progress.rank === null
    ? UI_COPY.landing.best(pct(progress.bestPercent ?? 0))
    : UI_COPY.landing.bestRank(pct(progress.bestPercent ?? 0), progress.rank);
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

  const freePlayScenarios = useMemo(
    () => scenarios.filter(scenario => scenario.id === FREE_PLAY_SCENARIO_ID),
    [scenarios],
  );

  return (
    <div className="scenario-select">
      <div className="scenario-select__header">
        <div className="scenario-select__brand">
          <span className="scenario-select__eyebrow">{UI_COPY.brand.tagline}</span>
          <h1 className="scenario-select__title">{UI_COPY.brand.name}</h1>
          <p className="scenario-select__hero-headline">{UI_COPY.landing.heroHeadline}</p>
          <p className="scenario-select__subtitle">{UI_COPY.landing.heroBody}</p>
        </div>
        <div className="scenario-select__plate" aria-hidden="true">
          <div className="scenario-select__sideline">
            <span>Sideline notes</span>
            <b>Blitz lane</b>
            <b>Gap window</b>
            <b>Safe route</b>
          </div>
          <img src={matchdayClash} alt="" />
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

      <div className="play-switch" role="tablist" aria-label={UI_COPY.landing.playModeLabel}>
        <button
          className={`play-switch__tab${playView === 'series' ? ' play-switch__tab--active' : ''}`}
          type="button"
          role="tab"
          aria-selected={playView === 'series'}
          onClick={() => setPlayView('series')}
        >
          {UI_COPY.landing.seriesTab}
        </button>
        <button
          className={`play-switch__tab${playView === 'individual' ? ' play-switch__tab--active' : ''}`}
          type="button"
          role="tab"
          aria-selected={playView === 'individual'}
          onClick={() => setPlayView('individual')}
        >
          {UI_COPY.landing.singlePlaysTab}
        </button>
        {isAdmin && (
          <button
            className="play-switch__tab"
            type="button"
            role="tab"
            aria-selected="false"
            onClick={onAdmin}
          >
            {UI_COPY.landing.puzzleCreatorTab}
          </button>
        )}
      </div>

      <p className="scenario-select__objective-guide">
        {UI_COPY.landing.objectiveGuidance}
      </p>

      {playView === 'series' ? (
        <section className="play-section">
          <div className="series-row">
            <div className="series-row__logo">
              {series.logo && SERIES_LOGOS[series.logo] ? (
                <span className="series-row__crest">
                  <img src={SERIES_LOGOS[series.logo]} alt={`${series.name} logo`} />
                </span>
              ) : null}
            </div>
            <div className="series-row__body">
              <span className="series-row__eyebrow">{UI_COPY.landing.seriesEyebrow}</span>
              <h2 className="series-row__title">{series.name}</h2>
              <p className="series-row__desc">{series.description}</p>
              <div className="series-row__meta">{formatProgress(seriesProgress)}</div>
            </div>
            <div className="series-row__actions">
              <button className="btn btn--primary" onClick={onStartSeries}>
                {UI_COPY.landing.startSeries}
              </button>
              <button className="btn btn--secondary" onClick={onSeriesLeaderboard}>
                {UI_COPY.landing.rankings}
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="play-section">
          <div className="challenge-section__header">
            <div>
              <h2 className="challenge-section__title">{UI_COPY.landing.singlePlaysHeading}</h2>
              <p className="challenge-section__subtitle">{UI_COPY.landing.singlePlaysPrompt}</p>
            </div>
          </div>

          <div className="challenge-tile-grid">
            {freePlayScenarios.map((s, index) => {
              return (
                <div key={s.id} className="challenge-tile">
                  <div className="challenge-tile__index" aria-hidden="true">
                    {UI_COPY.landing.playPrefix} {String(index + 1).padStart(2, '0')}
                  </div>
                  <div className="challenge-tile__body">
                    <div className="challenge-tile__name">{s.name}</div>
                    <div className="challenge-tile__desc">{s.description}</div>
                    <div className="challenge-tile__meta">{formatProgress(scenarioProgress[s.id])}</div>
                  </div>
                  <div className="challenge-tile__actions">
                    <button className="btn btn--primary" onClick={() => onPlay(s)}>
                      {UI_COPY.landing.play}
                    </button>
                    <button className="btn btn--secondary" onClick={() => onLeaderboard(s)}>
                      {UI_COPY.landing.rankings}
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
