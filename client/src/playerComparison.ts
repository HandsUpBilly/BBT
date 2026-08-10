import type { GameState, PlayerPiece } from './types';

/**
 * Which player card(s) the side rail should show.
 *
 * Normally one: whatever the cursor is over, falling back to the selected
 * piece. But every two-player action — block, blitz, pass, hand-off — is a
 * comparison. Deciding it means holding the acting piece's Strength against the
 * defender's, or a receiver's Agility against the range, and a single card that
 * *swapped* on hover made that a memory test: look at the attacker, move the
 * cursor, the attacker disappears.
 *
 * So during those actions the acting piece keeps its card and the hovered
 * player gets a second one below it.
 */
export interface PlayerComparison {
  /** Always the top card. Null only when nothing is selected or hovered. */
  primary: PlayerPiece | null;
  /** The second card, or null when there is nothing to compare against. */
  secondary: PlayerPiece | null;
}

/**
 * Is an action that needs a second player under way?
 *
 * `pendingBlock` covers a declared Blitz during its movement step, before a
 * target has been picked — the attacker is already committed to hitting
 * someone, so hovering candidates to size them up is exactly the point.
 * `blockChoice` and `pendingBlockResolution` cover the tail of a block, where
 * the outcome checklist and the push-back choice are both still about the two
 * players involved.
 */
export function isTwoPlayerAction(state: GameState): boolean {
  return state.isHandoffTargeting
    || state.isPassTargeting
    || state.isBlockTargeting
    || state.pendingBlock
    || state.blockChoice !== null
    || state.pendingBlockResolution !== null;
}

export function playerComparison(
  state: GameState,
  selected: PlayerPiece | null,
  hovered: PlayerPiece | null,
): PlayerComparison {
  const comparing =
    isTwoPlayerAction(state)
    && selected !== null
    && hovered !== null
    // Hovering the acting piece itself is not a comparison, and rendering it
    // twice would read as a bug.
    && hovered.id !== selected.id;

  if (comparing) return { primary: selected, secondary: hovered };

  // Unchanged single-card behaviour: the cursor wins, the selection is the
  // fallback so the card does not blank out the moment the cursor leaves the
  // board.
  return { primary: hovered ?? selected, secondary: null };
}
