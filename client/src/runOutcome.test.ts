import { describe, expect, it } from 'vitest';
import { humanBlocker, humanThrower, makeState, orcBlocker } from './test/gameState';
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

  describe('crowd-surf objective', () => {
    // A surf comes only from a push, and only a Block or a Blitz pushes — so
    // an adjacent standing opponent is what keeps the run alive.
    const crowdSurfState = (pieces: Parameters<typeof makeState>[0]) => ({
      ...makeState(pieces),
      objective: 'crowd-surf' as const,
    });

    it('stays live while a piece can still block an adjacent opponent', () => {
      const state = crowdSurfState([
        humanBlocker({ position: { col: 1, row: 10 } }),
        orcBlocker({ position: { col: 0, row: 10 } }),
      ]);
      expect(isScoringRunStalled(state)).toBe(false);
    });

    it('fails once every piece that could push has been activated', () => {
      const state = crowdSurfState([
        humanBlocker({ position: { col: 1, row: 10 }, activated: true }),
        orcBlocker({ position: { col: 0, row: 10 } }),
      ]);
      expect(isScoringRunStalled(state)).toBe(true);
    });

    it('fails when the puzzle disables both Block and Blitz', () => {
      const state = crowdSurfState([
        humanBlocker({ position: { col: 1, row: 10 } }),
        orcBlocker({ position: { col: 0, row: 10 } }),
      ]);
      expect(isScoringRunStalled(state, ['move', 'handoff', 'pass'])).toBe(true);
      expect(isScoringRunStalled(state, ['move', 'block'])).toBe(false);
    });

    it('does not turn a completed crowd surf into a failure', () => {
      const state = {
        ...crowdSurfState([humanBlocker({ position: { col: 1, row: 10 }, activated: true })]),
        phase: 'crowd-surf' as const,
      };
      expect(isScoringRunStalled(state)).toBe(false);
    });

    it('ignores the spent-carrier rule that only applies to touchdowns', () => {
      const state = crowdSurfState([
        humanThrower({ hasBall: true, activated: true, position: { col: 7, row: 10 } }),
        humanBlocker({ position: { col: 1, row: 10 } }),
        orcBlocker({ position: { col: 0, row: 10 } }),
      ]);
      expect(isScoringRunStalled(state)).toBe(false);
    });
  });

  it('fails a touchdown puzzle that disables every way to move the ball', () => {
    const state = makeState([humanThrower({ hasBall: true })]);
    expect(isScoringRunStalled(state, ['block', 'blitz'])).toBe(true);
    expect(isScoringRunStalled(state, ['move'])).toBe(false);
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
