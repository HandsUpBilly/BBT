import { describe, expect, it } from 'vitest';
import type { SeriesPuzzleResult } from './types';
import { upsertSeriesPuzzleResult } from './seriesResults';

const result = (scenarioId: string, probability: number): SeriesPuzzleResult => ({
  scenarioId,
  scenarioName: scenarioId,
  probability,
  diceCount: 1,
  moves: [],
});

describe('upsertSeriesPuzzleResult', () => {
  it('adds a newly completed drill', () => {
    expect(upsertSeriesPuzzleResult([result('one', 0.5)], result('two', 0.75)))
      .toEqual([result('one', 0.5), result('two', 0.75)]);
  });

  it('replaces a replayed drill without duplicating or reordering it', () => {
    const updated = upsertSeriesPuzzleResult(
      [result('one', 0.5), result('two', 0.75)],
      result('one', 0.9),
    );

    expect(updated).toEqual([result('one', 0.9), result('two', 0.75)]);
    expect(updated).toHaveLength(2);
  });
});
