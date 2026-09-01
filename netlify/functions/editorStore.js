import { getStore } from '@netlify/blobs';

// Seed data for the first read of each Blobs key.
//
// esbuild cannot glob, so this list is generated at build time from
// client/src/scenarios/*.json by scripts/generate-scenario-seed.mjs (wired into
// the Netlify build command). Do NOT hand-edit scenarioSeed.js — adding a
// scenario JSON file is all that is required, matching the client's
// import.meta.glob behavior.
import { STATIC_SCENARIOS, STATIC_SERIES } from './scenarioSeed.js';
import { normalizeScenario, normalizeSeriesCollection } from '../../shared/scenarioValidation.js';

const SCENARIOS_KEY = 'scenarios';
const SERIES_KEY = 'series-default';

export function editorStore() {
  return getStore({
    name: 'editor-drafts',
    siteID: process.env.NETLIFY_SITE_ID ?? process.env.SITE_ID,
    token: process.env.NETLIFY_TOKEN ?? process.env.NETLIFY_AUTH_TOKEN,
  });
}

/** Reads a key, seeding it from the static bundle on first read or corrupt data. */
async function readSeeded(store, key, seed) {
  const raw = await store.get(key, { type: 'text' });
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // fall through to reseed on corrupt data
    }
  }
  await store.set(key, JSON.stringify(seed));
  return seed;
}

export const readDraftScenarios = async store => (await readSeeded(store, SCENARIOS_KEY, STATIC_SCENARIOS)).map(normalizeScenario);
export const readDraftSeries = async store => normalizeSeriesCollection(await readSeeded(store, SERIES_KEY, STATIC_SERIES));

export const writeDraftScenarios = (store, scenarios) =>
  store.set(SCENARIOS_KEY, JSON.stringify(scenarios));
export const writeDraftSeries = (store, series) =>
  store.set(SERIES_KEY, JSON.stringify(series));

/**
 * The player-facing view: enabled scenarios only, with series ids narrowed to
 * scenarios that survive that filter. Without the narrowing, disabling a puzzle
 * that is still listed in the series silently shortened Series Play mid-run.
 */
export function toPublicView(scenarios, series) {
  const published = scenarios.filter(scenario => scenario.published !== false);
  const publishedIds = new Set(published.map(scenario => scenario.id));
  const collection = normalizeSeriesCollection(series);
  const narrowed = collection
    .filter(item => item.published !== false)
    .map(item => ({
      ...item,
      scenarioIds: item.scenarioIds.filter(id => publishedIds.has(id)),
    }));
  return {
    scenarios: published,
    // Keep the old helper contract for legacy callers/tests while every stored
    // collection and new public response uses the array form.
    series: Array.isArray(series) ? narrowed : narrowed[0] ?? { scenarioIds: [] },
  };
}
