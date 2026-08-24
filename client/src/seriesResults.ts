import type { SeriesPuzzleResult } from './types';

/**
 * Keeps exactly one result per Tutorial drill while allowing a completed drill
 * to be replayed. Replays replace the earlier result in place so completion
 * counts, canonical result ordering, and the final six-puzzle average remain
 * stable.
 */
export function upsertSeriesPuzzleResult(
  results: readonly SeriesPuzzleResult[],
  result: SeriesPuzzleResult,
): SeriesPuzzleResult[] {
  const existingIndex = results.findIndex(existing => existing.scenarioId === result.scenarioId);
  if (existingIndex < 0) return [...results, result];
  return results.map((existing, index) => index === existingIndex ? result : existing);
}
