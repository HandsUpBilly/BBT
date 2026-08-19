import type { Scenario, SeriesDefinition } from '../types';
import defaultSeriesData from './default.json';

export const FEATURED_SERIES_NAME = 'Humans vs Orcs: The Nuffle Shuffle';

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
  return LEGACY_FEATURED_SERIES_NAMES.has(series.name)
    ? { ...series, name: FEATURED_SERIES_NAME }
    : series;
}

// Static fallback only — the app's actual source of truth at runtime is the
// scenario/series data fetched via loadScenarioData() (see scenarios/runtime.ts),
// which reflects the currently published puzzles. This JSON is what the build
// bundles, used before that fetch resolves and if it fails.
export const defaultSeries = normalizeSeriesDefinition(defaultSeriesData as SeriesDefinition);

export function resolveSeriesScenarios(series: SeriesDefinition, scenarios: Scenario[]): Scenario[] {
  const byId = new Map(scenarios.map(scenario => [scenario.id, scenario]));
  return series.scenarioIds
    .map(id => byId.get(id))
    .filter((scenario): scenario is Scenario => Boolean(scenario));
}
