import type { Scenario, SeriesDefinition } from '../types';
import defaultSeriesData from './default.json';
import { scenarios } from '../scenarios';

export const defaultSeries = defaultSeriesData as SeriesDefinition;

export function resolveSeriesScenarios(series: SeriesDefinition = defaultSeries): Scenario[] {
  const byId = new Map(scenarios.map(scenario => [scenario.id, scenario]));
  return series.scenarioIds
    .map(id => byId.get(id))
    .filter((scenario): scenario is Scenario => Boolean(scenario));
}
