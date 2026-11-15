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

// The original seed only runs for an empty Blobs key. Established staging and
// production sites already have these keys, so new bundled puzzles/series were
// invisible even after deploy. Import this release's new IDs once, preserving
// existing author edits and deliberate deletions on subsequent reads.
const SERIES_EXPANSION_MIGRATION = 'series-expansion-2026-11-v1';
const NEW_PUZZLE_IDS = new Set([
  'scenario-008', 'scenario-009', 'scenario-010',
  ...Array.from({ length: 12 }, (_, index) => `blood-feud-${String(index + 1).padStart(2, '0')}`),
]);

async function migrateNewPuzzles(store, scenarios) {
  // Do not mark the migration as completed until the new seed is deployed.
  if (!STATIC_SCENARIOS.some(item => item.id === 'scenario-008')) return scenarios;
  const marker = `${SERIES_EXPANSION_MIGRATION}-scenarios`;
  if (await store.get(marker, { type: 'text' })) return scenarios;
  const seen = new Set(scenarios.map(item => item.id));
  const additions = STATIC_SCENARIOS.filter(item => NEW_PUZZLE_IDS.has(item.id) && !seen.has(item.id));
  const updated = additions.length ? [...scenarios, ...additions] : scenarios;
  if (additions.length) await store.set(SCENARIOS_KEY, JSON.stringify(updated));
  await store.set(marker, 'done');
  return updated;
}

async function migrateNewSeries(store, series) {
  if (!STATIC_SERIES.some(item => item.id === 'troll-toll')) return series;
  const marker = `${SERIES_EXPANSION_MIGRATION}-series`;
  if (await store.get(marker, { type: 'text' })) return series;
  const updated = [...series];
  const existingSecond = updated.find(item => item.scenarioIds.includes('scenario-007'));
  const newSecond = STATIC_SERIES.find(item => item.id === 'troll-toll');
  if (existingSecond && newSecond) {
    // Production may already have a custom Series 2 ID. Extend it rather than
    // introducing a duplicate series that competes for puzzle membership.
    const ids = new Set(existingSecond.scenarioIds);
    for (const id of newSecond.scenarioIds) ids.add(id);
    existingSecond.scenarioIds = [...ids];
  } else if (newSecond && !updated.some(item => item.id === newSecond.id)) {
    updated.push(newSecond);
  }
  const third = STATIC_SERIES.find(item => item.id === 'blood-feud');
  if (third && !updated.some(item => item.id === third.id)) updated.push(third);
  await store.set(SERIES_KEY, JSON.stringify(updated));
  await store.set(marker, 'done');
  return updated;
}

export const readDraftScenarios = async store =>
  (await migrateNewPuzzles(store, await readSeeded(store, SCENARIOS_KEY, STATIC_SCENARIOS))).map(normalizeScenario);
export const readDraftSeries = async store =>
  normalizeSeriesCollection(await migrateNewSeries(store,
    normalizeSeriesCollection(await readSeeded(store, SERIES_KEY, STATIC_SERIES))));

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
