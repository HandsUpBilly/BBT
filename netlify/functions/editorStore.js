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
const NEW_BLOOD_FEUD_IDS = Array.from({ length: 12 }, (_, index) =>
  `blood-feud-${String(index + 1).padStart(2, '0')}`);
const NEW_PUZZLE_IDS = new Set([
  'scenario-008', 'scenario-009', 'scenario-010',
  ...NEW_BLOOD_FEUD_IDS,
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
    for (const id of newSecond.scenarioIds.filter(id => !NEW_BLOOD_FEUD_IDS.includes(id))) ids.add(id);
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

// The first expansion can already be saved in Blobs. Move memberships in one
// write and leave manually reordered or reassigned lineups alone.
async function migrateBalancedSeries(store, series) {
  const marker = 'balanced-series-2026-11-v1';
  if (await store.get(marker, { type: 'text' })) return series;

  const secondSeed = STATIC_SERIES.find(item => item.id === 'troll-toll');
  const thirdSeed = STATIC_SERIES.find(item => item.id === 'blood-feud');
  const oldSecondIds = secondSeed.scenarioIds.filter(id => !NEW_BLOOD_FEUD_IDS.includes(id));
  const movedIds = secondSeed.scenarioIds.filter(id => NEW_BLOOD_FEUD_IDS.includes(id));
  const hasOrder = (item, ids) => item.scenarioIds.length === ids.length
    && ids.every((id, index) => item.scenarioIds[index] === id);
  const second = series.find(item => hasOrder(item, oldSecondIds));
  const third = series.find(item => item.id === thirdSeed.id);
  const ownsMovedPuzzle = series.some(item => item !== third
    && item.scenarioIds.some(id => movedIds.includes(id)));

  if (!second || !third || ownsMovedPuzzle) return series;
  // On a first-time expansion the third series is already built from the new seed.
  if (!hasOrder(third, NEW_BLOOD_FEUD_IDS) && !hasOrder(third, thirdSeed.scenarioIds)) return series;

  const updated = series.map(item => {
    if (item === second) {
      return {
        ...item,
        description: item.description === 'Imperial Nobility face the Black Orcs across four one-turn tactical matches. Break a close-marked carrier free, dismantle a defensive screen, throw a rival into the crowd and find a final scoring route. Every match offers multiple tactical approaches.'
          ? secondSeed.description : item.description,
        scenarioIds: secondSeed.scenarioIds,
      };
    }
    if (item === third) {
      return {
        ...item,
        description: item.description === 'The Reikland Reavers face the Black Orc bruisers in twelve one-turn tactical challenges. Each puzzle has one clear objective, but many ways to achieve it. Favour the cleanest probability line over needless dice.'
          ? thirdSeed.description : item.description,
        scenarioIds: thirdSeed.scenarioIds,
      };
    }
    return item;
  });
  await store.set(SERIES_KEY, JSON.stringify(updated));
  await store.set(marker, 'done');
  return updated;
}

// Series 2's eight-puzzle lineup originally reused four Human boards, but
// its matchup is Imperial Nobility vs Black Orcs. Those boards are impossible
// once applySeriesTeams switches the active team. Refresh *only* untouched
// legacy layouts, leaving bespoke editor adjustments alone.
const IMPERIAL_ROSTER_IDS = new Set([
  'blood-feud-01', 'blood-feud-04', 'blood-feud-05', 'blood-feud-06',
]);
const ORIGINAL_HUMAN_ROLES = Object.freeze({
  thrower: 'thrower', 'noble-blitzer': 'catcher',
  bodyguard: 'blitzer', retainer: 'lineman',
});
const ORIGINAL_HUMAN_NAMES = Object.freeze({
  thrower: 'Aldric Swiftfoot', catcher: 'Joren Fleetstep',
  blitzer: 'Cedric Linebreaker', lineman: 'Bramm Surehands',
});

function isUnmodifiedHumanBoard(old, updated) {
  if (!old || !updated || old.pieces?.length !== updated.pieces?.length) return false;
  if (!old.pieces.some(piece => piece.team === 'human')) return false;
  const byId = new Map(old.pieces.map(piece => [piece.id, piece]));
  return updated.pieces.every(piece => {
    const original = byId.get(piece.id);
    if (!original || original.position?.col !== piece.position.col
      || original.position?.row !== piece.position.row
      || original.hasBall !== piece.hasBall) return false;
    if (piece.team === 'black-orc') {
      return original.team === 'black-orc' && original.role === piece.role
        && original.name === piece.name;
    }
    const oldRole = ORIGINAL_HUMAN_ROLES[piece.role];
    return original.team === 'human' && original.role === oldRole
      && original.name === ORIGINAL_HUMAN_NAMES[oldRole];
  });
}

async function migrateImperialSeriesPuzzles(store, scenarios) {
  const targets = STATIC_SCENARIOS.filter(item => IMPERIAL_ROSTER_IDS.has(item.id));
  if (targets.length !== IMPERIAL_ROSTER_IDS.size
    || targets.some(item => item.pieces.some(piece => piece.team === 'human'))) return scenarios;
  const marker = 'imperial-series2-rosters-2026-11-v1';
  if (await store.get(marker, { type: 'text' })) return scenarios;
  const replacements = new Map(targets.map(item => [item.id, item]));
  let changed = false;
  const updated = scenarios.map(item => {
    const seed = replacements.get(item.id);
    if (!isUnmodifiedHumanBoard(item, seed)) return item;
    changed = true;
    // Retain metadata such as custom descriptions and enablement; convert
    // only the obsolete starting roster to the new series' legal team.
    return { ...item, activeTeam: seed.activeTeam, teams: seed.teams, pieces: seed.pieces };
  });
  if (changed) await store.set(SCENARIOS_KEY, JSON.stringify(updated));
  await store.set(marker, 'done');
  return updated;
}

export const readDraftScenarios = async store => {
  const scenarios = await migrateNewPuzzles(store, await readSeeded(store, SCENARIOS_KEY, STATIC_SCENARIOS));
  return (await migrateImperialSeriesPuzzles(store, scenarios)).map(normalizeScenario);
};
export const readDraftSeries = async store => {
  const saved = normalizeSeriesCollection(await readSeeded(store, SERIES_KEY, STATIC_SERIES));
  const expanded = await migrateNewSeries(store, saved);
  return normalizeSeriesCollection(await migrateBalancedSeries(store, expanded));
};

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
