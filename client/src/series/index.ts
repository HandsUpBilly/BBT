import type { Scenario, SeriesDefinition } from '../types';
import defaultSeriesData from './default.json';

// Static fallback only — the app's actual source of truth at runtime is the
// scenario/series data fetched via loadScenarioData() (see scenarios/runtime.ts),
// which reflects the currently published puzzles. This JSON is what the build
// bundles, used before that fetch resolves and if it fails.
export const defaultSeries = defaultSeriesData as SeriesDefinition;

export function resolveSeriesScenarios(series: SeriesDefinition, scenarios: Scenario[]): Scenario[] {
  const byId = new Map(scenarios.map(scenario => [scenario.id, scenario]));
  return series.scenarioIds
    .map(id => byId.get(id))
    .filter((scenario): scenario is Scenario => Boolean(scenario));
}
