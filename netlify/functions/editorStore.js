import { getStore } from '@netlify/blobs';

// Statically imported so esbuild bundles them into the function — these are
// the seed values used the first time the Blobs draft store is read. New
// scenario JSON files must be added here manually (esbuild can't glob).
import scenario001 from '../../client/src/scenarios/scenario-001.json' with { type: 'json' };
import scenario002 from '../../client/src/scenarios/scenario-002.json' with { type: 'json' };
import scenario003 from '../../client/src/scenarios/scenario-003.json' with { type: 'json' };
import scenario004 from '../../client/src/scenarios/scenario-004.json' with { type: 'json' };
import scenario005 from '../../client/src/scenarios/scenario-005.json' with { type: 'json' };
import defaultSeries from '../../client/src/series/default.json' with { type: 'json' };

const STATIC_SCENARIOS = [scenario001, scenario002, scenario003, scenario004, scenario005];
const SCENARIOS_KEY = 'scenarios';
const SERIES_KEY = 'series-default';

export function editorStore() {
  return getStore({
    name: 'editor-drafts',
    siteID: process.env.NETLIFY_SITE_ID ?? process.env.SITE_ID,
    token: process.env.NETLIFY_TOKEN ?? process.env.NETLIFY_AUTH_TOKEN,
  });
}

/** Reads the draft scenario list, seeding from the static bundle on first read. */
export async function readDraftScenarios(store) {
  const raw = await store.get(SCENARIOS_KEY, { type: 'text' });
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // fall through to reseed on corrupt data
    }
  }
  await store.set(SCENARIOS_KEY, JSON.stringify(STATIC_SCENARIOS));
  return STATIC_SCENARIOS;
}

export async function writeDraftScenarios(store, scenarios) {
  await store.set(SCENARIOS_KEY, JSON.stringify(scenarios));
}

/** Reads the draft default series, seeding from the static bundle on first read. */
export async function readDraftSeries(store) {
  const raw = await store.get(SERIES_KEY, { type: 'text' });
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // fall through to reseed on corrupt data
    }
  }
  await store.set(SERIES_KEY, JSON.stringify(defaultSeries));
  return defaultSeries;
}

export async function writeDraftSeries(store, series) {
  await store.set(SERIES_KEY, JSON.stringify(series));
}
