import { getStore } from '@netlify/blobs';

// Seed data for the first read of each Blobs key.
//
// esbuild cannot glob, so this list is generated at build time from
// client/src/scenarios/*.json by scripts/generate-scenario-seed.mjs (wired into
// the Netlify build command). Do NOT hand-edit scenarioSeed.js — adding a
// scenario JSON file is all that is required, matching the client's
// import.meta.glob behavior.
import { STATIC_SCENARIOS, STATIC_SERIES } from './scenarioSeed.js';

const SCENARIOS_KEY = 'scenarios';
const SERIES_KEY = 'series-default';
const PUBLISHED_SCENARIOS_KEY = 'published-scenarios';
const PUBLISHED_SERIES_KEY = 'published-series-default';

const SCENARIO_006_ID = 'scenario-006';
const SCENARIO_006_PLACEHOLDER_NAME = 'New Puzzle';
const SCENARIO_006_PLACEHOLDER_DESCRIPTION = 'Describe the scoring puzzle.';

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

function repairScenario006Placeholder(scenarios) {
  const seed = STATIC_SCENARIOS.find(scenario => scenario.id === SCENARIO_006_ID);
  if (!seed) return scenarios;

  const index = scenarios.findIndex(scenario => scenario.id === SCENARIO_006_ID);
  if (index < 0) {
    // Store was first seeded before Scenario 006 existed, so it was never
    // even created as a placeholder here — append the shipped seed.
    return [...scenarios, seed];
  }

  const scenario = scenarios[index];
  const isPlaceholder = scenario.name === SCENARIO_006_PLACEHOLDER_NAME
    && scenario.description === SCENARIO_006_PLACEHOLDER_DESCRIPTION;
  if (!isPlaceholder) return scenarios;
  return scenarios.map((s, scenarioIndex) => (scenarioIndex === index ? seed : s));
}

function repairScenario006Series(series) {
  const seededIds = STATIC_SERIES.scenarioIds ?? [];
  const currentIds = series?.scenarioIds ?? [];
  const legacyIds = seededIds.filter(id => id !== SCENARIO_006_ID);
  const isExactLegacySeries = seededIds.includes(SCENARIO_006_ID)
    && currentIds.length === legacyIds.length
    && currentIds.every((id, index) => id === legacyIds[index]);
  return isExactLegacySeries ? { ...series, scenarioIds: seededIds } : series;
}

async function readRepaired(store, key, seed, repair) {
  const value = await readSeeded(store, key, seed);
  const repaired = repair(value);
  if (repaired !== value) await store.set(key, JSON.stringify(repaired));
  return repaired;
}

export const readDraftScenarios = store =>
  readRepaired(store, SCENARIOS_KEY, STATIC_SCENARIOS, repairScenario006Placeholder);
export const readDraftSeries = store =>
  readRepaired(store, SERIES_KEY, STATIC_SERIES, repairScenario006Series);

export const writeDraftScenarios = (store, scenarios) =>
  store.set(SCENARIOS_KEY, JSON.stringify(scenarios));
export const writeDraftSeries = (store, series) =>
  store.set(SERIES_KEY, JSON.stringify(series));

/**
 * Published state is what the public scenarios endpoint serves to players. It's
 * a separate Blobs key from the draft state above — publishing is an explicit
 * copy-draft-to-published action (see editor-publish.js), not automatic on
 * every draft save, so an admin can stage several edits before making them live.
 */
export const readPublishedScenarios = store =>
  readRepaired(store, PUBLISHED_SCENARIOS_KEY, STATIC_SCENARIOS, repairScenario006Placeholder);
export const readPublishedSeries = store =>
  readRepaired(store, PUBLISHED_SERIES_KEY, STATIC_SERIES, repairScenario006Series);

export const writePublishedScenarios = (store, scenarios) =>
  store.set(PUBLISHED_SCENARIOS_KEY, JSON.stringify(scenarios));
export const writePublishedSeries = (store, series) =>
  store.set(PUBLISHED_SERIES_KEY, JSON.stringify(series));

/**
 * The player-facing view: published scenarios only, with series ids narrowed to
 * scenarios that survive that filter. Without the narrowing, disabling a puzzle
 * that is still listed in the series silently shortened Series Play mid-run.
 */
export function toPublicView(scenarios, series) {
  const published = scenarios.filter(scenario => scenario.published !== false);
  const publishedIds = new Set(published.map(scenario => scenario.id));
  return {
    scenarios: published,
    series: { ...series, scenarioIds: (series?.scenarioIds ?? []).filter(id => publishedIds.has(id)) },
  };
}
