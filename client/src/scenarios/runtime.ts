import type { Scenario, SeriesDefinition } from '../types';
import { scenarios as staticScenarios } from './index';
import { defaultSeries as staticSeries } from '../series';

export interface ScenarioData {
  scenarios: Scenario[];
  series: SeriesDefinition;
}

const staticData: ScenarioData = { scenarios: staticScenarios, series: staticSeries };

/**
 * Fetches the currently published scenario/series set from /api/scenarios
 * (netlify/functions/scenarios.js in production, the equivalent Express route
 * in local dev — see server/editor.js). Falls back to the build-time static
 * bundle (client/src/scenarios/*.json + series/default.json) if the request
 * fails, so the app still works if the API is briefly unavailable.
 *
 * This is what lets Admin Mode publishes reach players without a redeploy —
 * see README "Puzzle Editor on Netlify" for the full publish workflow.
 */
export async function loadScenarioData(): Promise<ScenarioData> {
  try {
    const response = await fetch('/api/scenarios');
    if (!response.ok) return staticData;
    const data = (await response.json()) as Partial<ScenarioData>;
    if (!Array.isArray(data.scenarios) || !data.series) return staticData;
    return { scenarios: data.scenarios, series: data.series };
  } catch {
    return staticData;
  }
}
