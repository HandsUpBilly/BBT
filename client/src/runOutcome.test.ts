import { describe, expect, it } from 'vitest';
import { humanThrower, makeState } from './test/gameState';
import { isScoringRunStalled, unfinishedBranches } from './runOutcome';

describe('isScoringRunStalled', () => {
  it('detects an activated ball carrier before touchdown', () => {
    const state = makeState([humanThrower({ hasBall: true, activated: true })]);
    expect(isScoringRunStalled(state)).toBe(true);
  });

  it('does not turn a touchdown into a failure', () => {
    const state = {
      ...makeState([humanThrower({ hasBall: true, activated: true })]),
      phase: 'touchdown' as const,
    };
    expect(isScoringRunStalled(state)).toBe(false);
  });

  it('does not fail while the carrier still has an activation', () => {
    const state = makeState([humanThrower({ hasBall: true })]);
    expect(isScoringRunStalled(state)).toBe(false);
  });
});

describe('unfinishedBranches', () => {
  it('keeps only authoring and needs-attention branches', () => {
    const branch = (id: string, status: 'scored' | 'conceded' | 'needs-attention' | 'authoring') => ({
      id,
      number: id,
      label: id,
      path: id,
      outcomes: [],
      weight: 0.25,
      value: 0,
      status,
      isViewed: false,
      canResetActivation: false,
    });
    expect(unfinishedBranches([
      branch('1', 'scored'),
      branch('2', 'authoring'),
      branch('3', 'needs-attention'),
      branch('4', 'conceded'),
    ]).map(item => item.id)).toEqual(['2', '3']);
  });
});
