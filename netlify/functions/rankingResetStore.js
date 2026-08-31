import { clearEntries, readEntries } from './blobEntries.js';

const CURRENT_SERIES_KEY = 'series';

function seriesStorageKey(id, currentSeriesId) {
  return id === currentSeriesId ? CURRENT_SERIES_KEY : `series:${id}`;
}

function seriesIdFromKey(key, currentSeriesId) {
  return key === CURRENT_SERIES_KEY ? currentSeriesId : key.startsWith('series:') ? key.slice(7) : key;
}

async function keysIn(store) {
  const result = await store.list();
  return result.blobs.map(blob => blob.key);
}

export async function readRankingResetSummary({ scenarioStore, seriesStore, scenarios, series }) {
  const scenarioNames = new Map(scenarios.map(scenario => [scenario.id, scenario.name]));
  const currentSeriesId = series?.id || 'default';
  const [storedScenarioKeys, storedSeriesKeys] = await Promise.all([
    keysIn(scenarioStore),
    keysIn(seriesStore),
  ]);
  const puzzleIds = [...new Set([...scenarioNames.keys(), ...storedScenarioKeys])].sort();
  const seriesIds = [...new Set([
    currentSeriesId,
    ...storedSeriesKeys.map(key => seriesIdFromKey(key, currentSeriesId)),
  ])].sort();

  const [puzzles, seriesBoards] = await Promise.all([
    Promise.all(puzzleIds.map(async id => ({
      id,
      name: scenarioNames.get(id) ?? id,
      count: (await readEntries(scenarioStore, id)).entries.length,
    }))),
    Promise.all(seriesIds.map(async id => ({
      id,
      name: id === currentSeriesId ? (series?.name || id) : id,
      count: (await readEntries(seriesStore, seriesStorageKey(id, currentSeriesId))).entries.length,
    }))),
  ]);

  return {
    totalEntries: [...puzzles, ...seriesBoards].reduce((total, board) => total + board.count, 0),
    series: seriesBoards,
    puzzles,
  };
}

export async function clearRankingTarget({ scenarioStore, seriesStore, scenarios, series, target }) {
  const summary = await readRankingResetSummary({ scenarioStore, seriesStore, scenarios, series });
  const currentSeriesId = series?.id || 'default';

  if (target.scope === 'all') {
    const [scenarioKeys, seriesKeys] = await Promise.all([keysIn(scenarioStore), keysIn(seriesStore)]);
    const removed = (await Promise.all([
      ...scenarioKeys.map(key => clearEntries(scenarioStore, key)),
      ...seriesKeys.map(key => clearEntries(seriesStore, key)),
    ])).reduce((total, count) => total + count, 0);
    return { removed };
  }

  const boards = target.scope === 'puzzle' ? summary.puzzles : summary.series;
  if (!boards.some(board => board.id === target.id)) return null;
  const removed = target.scope === 'puzzle'
    ? await clearEntries(scenarioStore, target.id)
    : await clearEntries(seriesStore, seriesStorageKey(target.id, currentSeriesId));
  return { removed };
}
