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

function entriesInWindow(entries, generatedAt, windowDays) {
  if (!Number.isInteger(windowDays) || windowDays <= 0) return validEntries(entries);
  const now = Date.parse(generatedAt);
  if (!Number.isFinite(now)) return [];
  const cutoff = now - windowDays * 24 * 60 * 60 * 1000;
  return validEntries(entries).filter(entry => {
    const timestamp = Date.parse(entry.date);
    return Number.isFinite(timestamp) && timestamp >= cutoff && timestamp <= now;
  });
}

function actionHabitSummary(entries) {
  const actions = { dodge: 0, gfi: 0, pickup: 0, catch: 0, pass: 0, block: 0, blitz: 0 };
  for (const entry of validEntries(entries)) {
    for (const move of Array.isArray(entry.moves) ? entry.moves : []) {
      if (move?.dodgeTarget) actions.dodge += 1;
      if (move?.isGfi) actions.gfi += 1;
      if (move?.pickupTarget) actions.pickup += 1;
      if (move?.catchTarget) actions.catch += 1;
      if (move?.passTarget) actions.pass += 1;
      if (move?.diceCount) actions.block += 1;
      if (move?.isBlitz) actions.blitz += 1;
    }
  }
  return actions;
}

function playerHabitSummary(entries, scenarioBoards, now) {
  const playerPuzzles = new Map();
  const identities = new Map();
  for (const [scenarioId, board] of Object.entries(scenarioBoards ?? {})) {
    for (const entry of validEntries(board)) {
      const key = playerKey(entry);
      if (!key) continue;
      if (!playerPuzzles.has(key)) playerPuzzles.set(key, new Set());
      playerPuzzles.get(key).add(scenarioId);
      identities.set(key, key.startsWith('user:') ? 'signedIn' : 'guest');
    }
  }
  const puzzleCounts = [...playerPuzzles.values()].map(puzzles => puzzles.size);
  const recent = days => new Set(validEntries(entries)
    .filter(entry => {
      const timestamp = Date.parse(entry.date);
      return Number.isFinite(timestamp) && timestamp >= now - days * 24 * 60 * 60 * 1000;
    })
    .map(playerKey).filter(Boolean)).size;
  return {
    signedInPlayers: [...identities.values()].filter(kind => kind === 'signedIn').length,
    guestPlayers: [...identities.values()].filter(kind => kind === 'guest').length,
    returningPlayers: puzzleCounts.filter(count => count > 1).length,
    averagePuzzlesPerPlayer: mean(puzzleCounts),
    activePlayers7Days: recent(7),
    activePlayers30Days: recent(30),
    onePuzzlePlayers: puzzleCounts.filter(count => count === 1).length,
    threePlusPuzzlePlayers: puzzleCounts.filter(count => count >= 3).length,
    actionCounts: actionHabitSummary(entries),
  };
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

export function buildPlayerStatistics({ scenarios, scenarioBoards, seriesEntries, generatedAt, windowDays }) {
  const timestamp = generatedAt ?? new Date().toISOString();
  const windowedBoards = Object.fromEntries(
    (Array.isArray(scenarios) ? scenarios : []).map(scenario => [
      scenario.id,
      entriesInWindow(scenarioBoards?.[scenario.id], timestamp, windowDays),
    ]),
  );
  const puzzles = (Array.isArray(scenarios) ? scenarios : []).map(scenario => ({
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    ...summarizePerformance(windowedBoards[scenario.id]),
  }));

  const allPuzzleEntries = (Array.isArray(scenarios) ? scenarios : [])
    .flatMap(scenario => windowedBoards[scenario.id]);
  const filteredSeriesEntries = entriesInWindow(seriesEntries, timestamp, windowDays);
  const allEntries = [...allPuzzleEntries, ...filteredSeriesEntries];
  const uniquePlayerKeys = new Set(allEntries.map(playerKey).filter(Boolean));

  return {
    generatedAt: timestamp,
    windowDays: Number.isInteger(windowDays) && windowDays > 0 ? windowDays : null,
    totals: {
      recordedPlayers: uniquePlayerKeys.size,
      puzzlePersonalBests: allPuzzleEntries.length,
      seriesPersonalBests: filteredSeriesEntries.length,
      averageProbability: mean(allPuzzleEntries.map(entry => entry.probability)),
      medianProbability: median(allPuzzleEntries.map(entry => entry.probability)),
      averageDiceCount: mean(allPuzzleEntries.map(entry => entry.diceCount)),
    },
    puzzles,
    series: summarizePerformance(filteredSeriesEntries),
    habits: playerHabitSummary(allPuzzleEntries, windowedBoards, Date.parse(timestamp)),
  };
}
