import type { PlayerPiece } from './types';
import { PlayerPanel } from './PlayerPanel';
import './MobileInfoSheet.css';

interface Props {
  piece: PlayerPiece | null;
  /**
   * The other half of a two-player action, when one is under way. Touch has no
   * hover, but tapping a piece sets the same inspected piece the cursor would,
   * so the comparison reaches this sheet by the same route.
   */
  comparisonPiece?: PlayerPiece | null;
  open: boolean;
  onToggle: () => void;
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
export function MobileInfoSheet({ piece, comparisonPiece, open, onToggle }: Props) {
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
          onClick={onToggle}
        >
          {comparisonPiece && piece
            ? `${piece.name} vs ${comparisonPiece.name}`
            : piece ? `Stats: ${piece.name}` : 'Tap a player for stats'}
        </button>
      </div>

      <div
        id="info-sheet-panel-player"
        aria-labelledby="info-sheet-tab-player"
        hidden={!open}
        className="info-sheet__panel info-sheet__panel--player"
      >
        <PlayerPanel piece={piece} side="right" role={comparisonPiece ? 'acting' : undefined} />
        {comparisonPiece && <PlayerPanel piece={comparisonPiece} side="right" role="target" />}
      </div>
    </section>
  );
}
