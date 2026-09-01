import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type { ProgressData } from './api';
import type { LeaderboardEntry, Scenario, SeriesDefinition, SeriesLeaderboardEntry } from './types';
import { BrandLogo } from './BrandLogo';
import { seriesLogoSource } from './seriesLogo';
import { teamAccentRgb, teamPluralLabel } from './teamPresentation';
import { UI_COPY } from './uiCopy';
import './ScenarioSelect.css';

const LOCAL_SCORE_KEY = 'bbt.localScores.v1';
const SERIES_SCORE_KEY = 'series';

type LocalScoreMap = Record<string, string[]>;
type PlayView = 'series' | 'individual';
type FreePlayFilter = 'all' | 'series' | 'specials';

const FREE_PLAY_FILTERS: Array<{ value: FreePlayFilter; label: string }> = [
  { value: 'all', label: UI_COPY.landing.allMatchesFilter },
  { value: 'series', label: UI_COPY.landing.seriesFilter },
  { value: 'specials', label: UI_COPY.landing.specialsFilter },
];

interface ScenarioProgress {
  played: boolean;
  bestPercent: number | null;
  rank: number | null;
  entries: number;
}

interface Props {
  scenarios: Scenario[];
  series: SeriesDefinition[] | SeriesDefinition;
  onPlay: (scenario: Scenario) => void;
  onLeaderboard: (scenario: Scenario) => void;
  onStartSeries: (series: SeriesDefinition) => void;
  onSeriesLeaderboard: (series: SeriesDefinition) => void;
  onAdmin: () => void;
  onHelp: () => void;
  onSettings: () => void;
  onAbout: () => void;
  /** Fetched once by App in a single request; undefined while it is in flight. */
  progress?: ProgressData;
  userId?: string;
  isAdmin: boolean;
  userMenu: ReactNode;
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function objectiveLabel(objective: string | undefined): string {
  return (objective ?? 'touchdown')
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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
  onHelp,
  onSettings,
  onAbout,
  progress,
  userId,
  isAdmin,
  userMenu,
}: Props) {
  const [playView, setPlayView] = useState<PlayView>('series');
  const [freePlayFilter, setFreePlayFilter] = useState<FreePlayFilter>('all');
  const seriesList = useMemo(() => Array.isArray(series) ? series : [series], [series]);

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
    () => scenarios.filter(scenario => scenario.freePlay),
    [scenarios],
  );

  const seriesScenarioIds = useMemo(() => new Set(seriesList.flatMap(item => item.scenarioIds)), [seriesList]);
  const visibleFreePlayScenarios = freePlayScenarios.filter(scenario => freePlayFilter === 'all'
    || (freePlayFilter === 'series' && seriesScenarioIds.has(scenario.id))
    || (freePlayFilter === 'specials' && !seriesScenarioIds.has(scenario.id)));

  return (
    <div className="scenario-select">
      <header className="scenario-select__topbar">
        <BrandLogo variant="wordmark" className="scenario-select__wordmark" decorative />
        <nav className="scenario-select__utility-nav" aria-label={UI_COPY.landing.utilityNavLabel}>
          {isAdmin && (
            <button type="button" onClick={onAdmin}>{UI_COPY.landing.puzzleCreatorTab}</button>
          )}
          <button type="button" onClick={onHelp}>{UI_COPY.landing.help}</button>
          <button type="button" onClick={onSettings}>{UI_COPY.landing.settings}</button>
          <button type="button" onClick={onAbout}>{UI_COPY.landing.about}</button>
        </nav>
        <div className="scenario-select__controls">
          {userMenu}
        </div>
      </header>

      <div className="scenario-select__header">
        <h1 className="scenario-select__title">Turn 16</h1>
        <div className="scenario-select__brand">
          <div className="scenario-select__hero-copy">
            <p className="scenario-select__hero-title">{UI_COPY.landing.heroTitle}</p>
            <p className="scenario-select__subtitle">{UI_COPY.landing.heroPrompt}</p>
          </div>
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
      </div>

      {playView === 'series' ? (
        <section className="play-section">
          {seriesList.map((item, index) => {
            const logoSource = seriesLogoSource(item.logo);
            const stepCount = item.scenarioIds.length;
            const [firstTeam, secondTeam] = item.teams ?? ['human', 'orc'];
            const seriesColourStyle = {
              '--series-team-a-rgb': teamAccentRgb(firstTeam),
              '--series-team-b-rgb': teamAccentRgb(secondTeam),
            } as CSSProperties;
            return (
              <div className="series-row" key={item.id} style={seriesColourStyle}>
                <div className="series-row__logo">
                  {logoSource ? (
                    <span className="series-row__crest">
                      <img src={logoSource} alt={`${item.name} logo`} />
                    </span>
                  ) : null}
                </div>
                <div className="series-row__body">
                  <span className="series-row__eyebrow">{String(index + 1).padStart(2, '0')} {item.label ?? 'Series'}</span>
                  <h2 className="series-row__title">{item.name}</h2>
                  <p className="series-row__desc">{item.description}</p>
                  <div className="series-row__meta">{(item.teams ?? ['human', 'orc']).map(teamPluralLabel).join(' vs ')} · {objectiveLabel(item.objective)} · {stepCount} {stepCount === 1 ? 'step' : 'steps'}</div>
                  <div className="series-row__meta">{formatProgress(seriesProgress)}</div>
                </div>
                <div className="series-row__actions">
                  <button className="btn btn--primary" onClick={() => onStartSeries(item)}>
                    {UI_COPY.landing.play}
                  </button>
                  <button className="btn btn--secondary" onClick={() => onSeriesLeaderboard(item)}>
                    {UI_COPY.landing.rankings}
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      ) : (
        <section className="play-section">
          <div className="challenge-section__header">
            <div>
              <h2 className="challenge-section__title">{UI_COPY.landing.singlePlaysHeading}</h2>
              <p className="challenge-section__subtitle">{UI_COPY.landing.singlePlaysPrompt}</p>
            </div>
          </div>

          <div
            className="challenge-filter"
            role="group"
            aria-label={UI_COPY.landing.freePlayFilterLabel}
          >
            {FREE_PLAY_FILTERS.map(filter => (
              <button
                key={filter.value}
                type="button"
                className={`challenge-filter__button${freePlayFilter === filter.value ? ' challenge-filter__button--active' : ''}`}
                aria-pressed={freePlayFilter === filter.value}
                onClick={() => setFreePlayFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="challenge-tile-grid">
            {visibleFreePlayScenarios.map((s, index) => {
              const owningSeries = seriesList.find(item => item.scenarioIds.includes(s.id));
              const isTutorial = owningSeries?.label?.trim().toLocaleLowerCase() === 'tutorial';
              return (
                <div key={s.id} className="challenge-tile">
                  <div className="challenge-tile__header">
                    {owningSeries ? (
                      <div className="challenge-tile__origin">
                        {isTutorial ? UI_COPY.landing.tutorialOrigin : UI_COPY.landing.seriesOrigin(owningSeries.name)}
                      </div>
                    ) : null}
                    <div className="challenge-tile__index" aria-hidden="true">
                      {UI_COPY.landing.playPrefix} {String(index + 1).padStart(2, '0')}
                    </div>
                  </div>
                  <div className="challenge-tile__body">
                    <div className="challenge-tile__name">{s.name}</div>
                    {isTutorial ? <div className="challenge-tile__context">{UI_COPY.landing.tutorialFinalPuzzle}</div> : null}
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
            {visibleFreePlayScenarios.length === 0 && (
              <div className="challenge-empty" role="status">
                {UI_COPY.landing.noSpecials}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
