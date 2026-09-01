import type { Scenario, SeriesDefinition } from '../types';
import { scenarios as staticScenarios } from './index';
import { allSeries as staticSeries, normalizeSeriesDefinition } from '../series';
import { normalizeScenario, normalizeSeriesCollection } from '../../../shared/scenarioValidation.js';

export interface ScenarioData {
  scenarios: Scenario[];
  series: SeriesDefinition[];
}

const staticData: ScenarioData = { scenarios: staticScenarios, series: staticSeries };

/**
 * Fetches the currently enabled saved scenario/series set from /api/scenarios
 * (netlify/functions/scenarios.js in production, the equivalent Express route
 * in local dev — see server/editor.js). Falls back to the build-time static
 * bundle (client/src/scenarios/*.json + series/default.json) if the request
 * fails, so the app still works if the API is briefly unavailable.
 *
 * This is what lets Puzzle Creator saves reach players without a redeploy.
 */
function responseData(data: Partial<ScenarioData>): ScenarioData | null {
  if (!Array.isArray(data.scenarios) || !data.series) return null;
  return {
    scenarios: data.scenarios.map(normalizeScenario),
    series: normalizeSeriesCollection(data.series).map(normalizeSeriesDefinition),
  };
}

function adminView(data: ScenarioData): ScenarioData {
  const scenarios = data.scenarios.filter(scenario => scenario.published !== false || scenario.adminEnabled === true);
  const visibleIds = new Set(scenarios.map(scenario => scenario.id));
  const series = data.series
    .filter(item => item.published !== false || item.adminEnabled === true)
    .map(item => ({ ...item, scenarioIds: item.scenarioIds.filter(id => visibleIds.has(id)) }));
  return { scenarios, series };
}

async function loadPublicData(): Promise<ScenarioData> {
  try {
    const response = await fetch('/api/scenarios');
    if (!response.ok) return staticData;
    return responseData((await response.json()) as Partial<ScenarioData>) ?? staticData;
  } catch {
    return staticData;
  }
}

export async function loadScenarioData(options: { admin?: boolean; idToken?: string | null } = {}): Promise<ScenarioData> {
  if (options.admin) {
    try {
      const response = await fetch('/api/editor/scenarios', {
        headers: options.idToken ? { Authorization: `Bearer ${options.idToken}` } : {},
      });
      if (response.ok) {
        const data = responseData((await response.json()) as Partial<ScenarioData>);
        if (data) return adminView(data);
      }
    } catch {
      // Fall through to the public view if admin storage/auth is unavailable.
    }
  }
  return loadPublicData();
}
