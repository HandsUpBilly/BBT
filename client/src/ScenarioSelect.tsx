import { useEffect, useMemo, useState } from 'react';
import { fetchLeaderboard, fetchSeriesLeaderboard } from './api';
import { scenarios } from './scenarios';
import type { LeaderboardEntry, Scenario, SeriesLeaderboardEntry } from './types';
import './ScenarioSelect.css';

const LOCAL_SCORE_KEY = 'bbt.localScores.v1';
const SERIES_SCORE_KEY = 'series';

type LocalScoreMap = Record<string, string[]>;

interface ScenarioProgress {
  played: boolean;
  bestPercent: number | null;
  rank: number | null;
  entries: number;
}

interface Props {
  onPlay: (scenario: Scenario) => void;
  onLeaderboard: (scenario: Scenario) => void;
  onStartSeries: () => void;
  onSeriesLeaderboard: () => void;
  onAdmin: () => void;
  progressRefreshKey: number;
}

const CHALLENGE_COPY: Record<string, { title: string; description: string }> = {
  'scenario-001': {
    title: 'Opening Lane',
    description: 'A compact scoring puzzle with pressure around the central channel.',
  },
  'scenario-002': {
    title: 'Broken Screen',
    description: 'A wider attacking shape with multiple contact points and a deeper finish.',
  },
};

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

function progressFromEntries(entries: LeaderboardEntry[] | SeriesLeaderboardEntry[], localIds: string[] = []): ScenarioProgress {
  const localIdSet = new Set(localIds);
  let bestPercent: number | null = null;
  let bestRank: number | null = null;

  entries.forEach((entry, index) => {
    if (!localIdSet.has(entry.id)) return;
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
    return progress.entries > 0 ? `Not played · ${progress.entries} ranked` : 'Not played';
  }
  return `Best ${pct(progress.bestPercent ?? 0)} · Rank #${progress.rank}`;
}

export function ScenarioSelect({
  onPlay,
  onLeaderboard,
  onStartSeries,
  onSeriesLeaderboard,
  onAdmin,
  progressRefreshKey,
}: Props) {
  const [leaderboards, setLeaderboards] = useState<Record<string, LeaderboardEntry[]>>({});
  const [seriesLeaderboard, setSeriesLeaderboard] = useState<SeriesLeaderboardEntry[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadProgress() {
      const [scenarioResults, seriesResults] = await Promise.all([
        Promise.all(
          scenarios.map(async scenario => {
            try {
              return [scenario.id, await fetchLeaderboard(scenario.id)] as const;
            } catch {
              return [scenario.id, []] as const;
            }
          }),
        ),
        fetchSeriesLeaderboard().catch(() => [] as SeriesLeaderboardEntry[]),
      ]);

      if (!cancelled) {
        setLeaderboards(Object.fromEntries(scenarioResults));
        setSeriesLeaderboard(seriesResults);
      }
    }

    void loadProgress();
    return () => { cancelled = true; };
  }, [progressRefreshKey]);

  const localScores = readLocalScores();

  const scenarioProgress = useMemo(() => {
    return Object.fromEntries(
      scenarios.map(scenario => [
        scenario.id,
        progressFromEntries(leaderboards[scenario.id] ?? [], localScores[scenario.id]),
      ]),
    ) as Record<string, ScenarioProgress>;
  }, [leaderboards, localScores]);

  const seriesProgress = useMemo(() => {
    return progressFromEntries(seriesLeaderboard, localScores[SERIES_SCORE_KEY]);
  }, [seriesLeaderboard, localScores]);

  const individualProgress = useMemo(() => {
    const items = scenarios.map(scenario => scenarioProgress[scenario.id]).filter(Boolean);
    const playedItems = items.filter(item => item.played && item.bestPercent !== null);
    if (playedItems.length === 0) {
      return {
        played: false,
        bestPercent: null,
        rank: null,
        entries: items.reduce((total, item) => total + item.entries, 0),
      };
    }

    return playedItems.reduce((best, item) => {
      if (!best || (item.bestPercent ?? 0) > (best.bestPercent ?? 0)) return item;
      return best;
    });
  }, [scenarioProgress]);

  return (
    <div className="scenario-select">
      <div className="scenario-select__header">
        <h1 className="scenario-select__title">BB Tactics</h1>
        <p className="scenario-select__subtitle">
          The gauntlet rewards clean routes, controlled risk, and the highest-probability score.
        </p>
      </div>

      <div className="mode-grid">
        <section className="mode-card mode-card--primary">
          <div className="mode-card__body">
            <span className="mode-card__eyebrow">Ranked path</span>
            <h2 className="mode-card__title">Series Play</h2>
            <p className="mode-card__desc">
              Run the full challenge set as a gauntlet and track your aggregate performance.
            </p>
            <div className="mode-card__status">{formatProgress(seriesProgress)}</div>
          </div>
          <div className="mode-card__actions">
            <button className="btn btn--primary" onClick={onStartSeries}>
              Start Series
            </button>
            <button className="btn btn--secondary" onClick={onSeriesLeaderboard}>
              Series Rankings
            </button>
          </div>
        </section>

        <section className="mode-card">
          <div className="mode-card__body">
            <span className="mode-card__eyebrow">Scenario board</span>
            <h2 className="mode-card__title">Individual Challenges</h2>
            <p className="mode-card__desc">
              Pick a board directly, revisit your best route, and compare the table.
            </p>
            <div className="mode-card__status">{formatProgress(individualProgress)}</div>
          </div>
          <a className="btn btn--secondary" href="#individual-challenges">
            Browse Challenges
          </a>
        </section>
      </div>

      <section id="individual-challenges" className="challenge-section">
        <div className="challenge-section__header">
          <h2 className="challenge-section__title">Individual Challenges</h2>
          <p className="challenge-section__subtitle">Choose a ranked board.</p>
        </div>

        <div className="scenario-select__list">
          {scenarios.map(s => {
            const copy = CHALLENGE_COPY[s.id] ?? { title: s.name, description: s.description };
            return (
              <div key={s.id} className="scenario-card">
                <div className="scenario-card__body">
                  <div className="scenario-card__name">{copy.title}</div>
                  <div className="scenario-card__desc">{copy.description}</div>
                  <div className="scenario-card__meta">{formatProgress(scenarioProgress[s.id])}</div>
                </div>
                <div className="scenario-card__actions">
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

      <div className="scenario-select__footer">
        <button className="btn btn--ghost" onClick={onAdmin}>
          Admin Mode
        </button>
      </div>
    </div>
  );
}
