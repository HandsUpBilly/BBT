import { describe, expect, it } from 'vitest';
import { isTwoPlayerAction, playerComparison } from './playerComparison';
import { makeState, humanBlocker, orcBlocker } from './test/gameState';
import type { GameState } from './types';

const attacker = humanBlocker({ id: 'attacker' });
const defender = orcBlocker({ id: 'defender' });

function stateWith(overrides: Partial<GameState>): GameState {
  return { ...makeState([attacker, defender]), ...overrides };
}

const idle = stateWith({});

/** Every state that means "an action involving a second player is under way". */
const twoPlayerStates: Array<[string, GameState]> = [
  ['hand-off targeting', stateWith({ isHandoffTargeting: true })],
  ['pass targeting', stateWith({ isPassTargeting: true })],
  ['block targeting', stateWith({ isBlockTargeting: true })],
  ['a declared blitz still moving', stateWith({ pendingBlock: true, pendingBlockIsBlitz: true })],
  ['a block resolving its outcome', stateWith({
    blockChoice: {
      defenderId: 'defender', isBlitz: false, diceCount: 2, picker: 'attacker',
      attackerAssists: 0, defenderAssists: 0,
      outcomeProbs: {
        'attacker-down': 0, 'both-down': 0, push: 0, 'defender-stumbles': 0, 'defender-down': 0,
      },
    },
  })],
  ['a block choosing a push-back square', stateWith({
    pendingBlockResolution: {
      attackerId: 'attacker', defenderId: 'defender', resolvedFace: 'push',
      defenderFalls: false, defenderFrom: { col: 7, row: 7 },
      offerFollowUp: false, isBlitz: false,
    },
  })],
];

describe('isTwoPlayerAction', () => {
  it('is false while nothing is being aimed', () => {
    expect(isTwoPlayerAction(idle)).toBe(false);
  });

  it.each(twoPlayerStates)('is true during %s', (_label, state) => {
    expect(isTwoPlayerAction(state)).toBe(true);
  });
});

describe('playerComparison', () => {
  it.each(twoPlayerStates)('pairs the acting piece with the hovered one during %s', (_l, state) => {
    expect(playerComparison(state, attacker, defender)).toEqual({
      primary: attacker,
      secondary: defender,
    });
  });

  it('keeps the acting piece on top, whichever way round the hover happens', () => {
    // The attacker is the selection, so it is the top card even though the
    // cursor is on the defender — that is the whole point: the card the player
    // was reading does not vanish when they go to look at the target.
    const { primary, secondary } = playerComparison(
      stateWith({ isBlockTargeting: true }), attacker, defender,
    );
    expect(primary?.id).toBe('attacker');
    expect(secondary?.id).toBe('defender');
  });

  it('shows one card when no two-player action is under way', () => {
    // Ordinary movement: hovering still swaps the single card, as before.
    expect(playerComparison(idle, attacker, defender)).toEqual({
      primary: defender,
      secondary: null,
    });
  });

  it('does not pair a piece with itself', () => {
    expect(playerComparison(stateWith({ isBlockTargeting: true }), attacker, attacker)).toEqual({
      primary: attacker,
      secondary: null,
    });
  });

  it('shows the acting piece alone when the cursor is off the board', () => {
    expect(playerComparison(stateWith({ isPassTargeting: true }), attacker, null)).toEqual({
      primary: attacker,
      secondary: null,
    });
  });

  it('shows the hovered piece alone when nothing is selected', () => {
    // Nothing can be "acting", so there is no pair to make.
    expect(playerComparison(stateWith({ isPassTargeting: true }), null, defender)).toEqual({
      primary: defender,
      secondary: null,
    });
  });

  it('falls back to the selection so the card does not blank on mouse-out', () => {
    expect(playerComparison(idle, attacker, null)).toEqual({
      primary: attacker,
      secondary: null,
    });
  });

  it('has nothing to show when nothing is selected or hovered', () => {
    expect(playerComparison(idle, null, null)).toEqual({ primary: null, secondary: null });
  });
});
