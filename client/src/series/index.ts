import type { Scenario, SeriesDefinition } from '../types';
const seriesModules = import.meta.glob('./*.json', { eager: true, import: 'default' }) as Record<string, SeriesDefinition>;

export const FEATURED_SERIES_NAME = 'Humans vs Orcs: The Nuffle Shuffle';
export const FEATURED_SERIES_LOGO = 'nuffle-shuffle';
export const FEATURED_SERIES_LABEL = 'Tutorial';

const LEGACY_FEATURED_SERIES_NAMES = new Set([
  'Humans vs Orcs: Touchdown or Bust',
  'Humans vs Orcs: The Nuffle Shuffle',
]);

/**
 * Published series metadata predates the current bundled name and can remain
 * in Netlify Blobs across deployments. Migrate only the two known old titles;
 * any genuinely custom Puzzle Creator name remains the source of truth.
 */
export function normalizeSeriesDefinition(series: SeriesDefinition): SeriesDefinition {
  if (!LEGACY_FEATURED_SERIES_NAMES.has(series.name)) return series;
  // Published metadata can predate `logo`: the static chooser crest would
  // otherwise flash, then disappear when the runtime response replaces it.
  return {
    ...series,
    name: FEATURED_SERIES_NAME,
    label: series.label || FEATURED_SERIES_LABEL,
    logo: series.logo || FEATURED_SERIES_LOGO,
  };
}

// Static fallback only — the app's actual source of truth at runtime is the
// scenario/series data fetched via loadScenarioData() (see scenarios/runtime.ts),
// which reflects the currently published puzzles. This JSON is what the build
// bundles, used before that fetch resolves and if it fails.
export const allSeries = Object.values(seriesModules)
  .map(normalizeSeriesDefinition)
  .sort((left, right) => (left.order ?? 0) - (right.order ?? 0) || left.name.localeCompare(right.name));
export const defaultSeries: SeriesDefinition = allSeries.find(series => series.id === 'default') ?? allSeries[0] ?? {
  id: 'default', name: 'Default Series', description: '', scenarioIds: [], teams: ['human', 'orc'], objective: 'touchdown', order: 0,
};

/** Series matchup settings are authoritative for every puzzle in that run. */
export function applySeriesTeams(series: SeriesDefinition, scenario: Scenario): Scenario {
  const teams = series.teams ?? scenario.teams ?? ['human', 'orc'];
  return {
    ...scenario,
    teams: [...teams],
    activeTeam: teams.includes(scenario.activeTeam) ? scenario.activeTeam : teams[0],
  };
}

export function resolveSeriesScenarios(series: SeriesDefinition, scenarios: Scenario[]): Scenario[] {
  const byId = new Map(scenarios.map(scenario => [scenario.id, scenario]));
  return series.scenarioIds
    .map(id => byId.get(id))
    .filter((scenario): scenario is Scenario => Boolean(scenario))
    .map(scenario => applySeriesTeams(series, scenario));
}
