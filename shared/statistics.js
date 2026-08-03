/**
 * Anonymous player-performance aggregation shared by Express and Netlify.
 *
 * Leaderboards retain one personal best per player, not every attempt. These
 * metrics therefore describe recorded personal bests and must never be labeled
 * as attempt counts or completion rates.
 */

function validEntries(entries) {
  return (Array.isArray(entries) ? entries : []).filter(entry =>
    entry
    && Number.isFinite(entry.probability)
    && entry.probability > 0
    && entry.probability <= 1
    && Number.isFinite(entry.diceCount)
    && entry.diceCount >= 0,
  );
}

function playerKey(entry) {
  if (typeof entry.userId === 'string' && entry.userId.trim()) {
    return `user:${entry.userId.trim()}`;
  }
  const name = typeof entry.name === 'string' ? entry.name.trim().toLocaleLowerCase() : '';
  return name ? `guest:${name}` : null;
}

function mean(values) {
  if (values.length === 0) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function latestDate(entries) {
  const timestamps = entries
    .map(entry => Date.parse(entry.date))
    .filter(Number.isFinite);
  return timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : null;
}

export function summarizePerformance(entries) {
  const valid = validEntries(entries);
  const probabilities = valid.map(entry => entry.probability);
  const playerKeys = new Set(valid.map(playerKey).filter(Boolean));

  return {
    recordedPlayers: playerKeys.size,
    personalBests: valid.length,
    averageProbability: mean(probabilities),
    medianProbability: median(probabilities),
    bestProbability: probabilities.length > 0 ? Math.max(...probabilities) : null,
    averageDiceCount: mean(valid.map(entry => entry.diceCount)),
    latestScoreAt: latestDate(valid),
  };
}

export function buildPlayerStatistics({ scenarios, scenarioBoards, seriesEntries, generatedAt }) {
  const puzzles = (Array.isArray(scenarios) ? scenarios : []).map(scenario => ({
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    ...summarizePerformance(scenarioBoards?.[scenario.id]),
  }));

  const allPuzzleEntries = (Array.isArray(scenarios) ? scenarios : [])
    .flatMap(scenario => validEntries(scenarioBoards?.[scenario.id]));
  const allEntries = [...allPuzzleEntries, ...validEntries(seriesEntries)];
  const uniquePlayerKeys = new Set(allEntries.map(playerKey).filter(Boolean));

  return {
    generatedAt: generatedAt ?? new Date().toISOString(),
    totals: {
      recordedPlayers: uniquePlayerKeys.size,
      puzzlePersonalBests: allPuzzleEntries.length,
      seriesPersonalBests: validEntries(seriesEntries).length,
      averageProbability: mean(allPuzzleEntries.map(entry => entry.probability)),
      medianProbability: median(allPuzzleEntries.map(entry => entry.probability)),
      averageDiceCount: mean(allPuzzleEntries.map(entry => entry.diceCount)),
    },
    puzzles,
    series: summarizePerformance(seriesEntries),
  };
}
