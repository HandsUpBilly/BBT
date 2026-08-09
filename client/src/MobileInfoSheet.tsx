import { useState } from 'react';
import type { PlayerPiece } from './types';
import { PlayerPanel } from './PlayerPanel';
import './MobileInfoSheet.css';

interface Props {
  piece: PlayerPiece | null;
}

/**
 * The player card, for screens with no room for it beside the board.
 *
 * Both side columns are `display: none` below the touch breakpoint, with
 * nothing put in their place — so a phone player could not see a player's
 * stats or skills at all. A portrait board leaves real vertical space under
 * it (about 235px on a 375×812 phone, because the board is width-bound at 15
 * columns), which is exactly where this goes: no overlay, nothing covering
 * the pitch.
 *
 * The roll history was a second tab here and is now a toolbar dropdown. It is
 * consulted mid-decision and belongs with the controls; the player card
 * follows whichever piece was last tapped, so it reads better as a panel that
 * sits under the board it refers to.
 */
export function MobileInfoSheet({ piece }: Props) {
  // Collapsed by default. Open, the panel competes with the board for height,
  // and on a 320×568 phone the board loses — squares drop from 20px to 17px.
  // The board is the game, so it keeps the space until the player asks for
  // something else; the toggle alone costs 50px.
  const [open, setOpen] = useState(false);

  return (
    <section
      className={`info-sheet${open ? ' info-sheet--open' : ''}`}
      aria-label="Player details"
    >
      <div className="info-sheet__tabs">
        <button
          type="button"
          id="info-sheet-tab-player"
          aria-expanded={open}
          aria-controls="info-sheet-panel-player"
          className={`info-sheet__tab${open ? ' info-sheet__tab--active' : ''}`}
          onClick={() => setOpen(o => !o)}
        >
          {piece ? piece.name : 'Player'}
        </button>
      </div>

      <div
        id="info-sheet-panel-player"
        aria-labelledby="info-sheet-tab-player"
        hidden={!open}
        className="info-sheet__panel info-sheet__panel--player"
      >
        <PlayerPanel piece={piece} side="right" />
      </div>
    </section>
  );
}
