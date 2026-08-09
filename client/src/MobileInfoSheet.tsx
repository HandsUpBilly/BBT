import { useState } from 'react';
import type { ActionLogEntry, PlayerPiece } from './types';
import { PlayerPanel } from './PlayerPanel';
import { DiceLog } from './DiceLog';
import './MobileInfoSheet.css';

interface Props {
  piece: PlayerPiece | null;
  log: ActionLogEntry[];
  pendingProb: number;
  pendingTargets: number[];
}

/** `null` is the collapsed state — tab bar only, no panel. */
type Tab = 'player' | 'log' | null;

/**
 * The player card and the dice log, for screens with no room beside the board.
 *
 * Both live in side columns that are `display: none` below the touch
 * breakpoint, with nothing put in their place — so a phone player could not
 * see a player's stats or skills, nor any history of the rolls they had
 * committed to. In a puzzle scored on the product of those rolls, the log is
 * not decoration.
 *
 * A portrait board leaves real vertical space under it (about 235px on a
 * 375×812 phone, because the board is width-bound at 15 columns), which is
 * exactly where this goes — no overlay, nothing covering the pitch.
 */
export function MobileInfoSheet({ piece, log, pendingProb, pendingTargets }: Props) {
  // Collapsed by default. Open, the panel competes with the board for height,
  // and on a 320×568 phone the board loses — squares drop from 20px to 17px.
  // The board is the game, so it keeps the space until the player asks for
  // something else; the tab bar alone costs 50px.
  const [tab, setTab] = useState<Tab>(null);
  const toggle = (next: Exclude<Tab, null>) => setTab(cur => (cur === next ? null : next));

  return (
    <section
      className={`info-sheet${tab ? ' info-sheet--open' : ''}`}
      aria-label="Player and roll details"
    >
      <div className="info-sheet__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          id="info-sheet-tab-player"
          aria-selected={tab === 'player'}
          aria-expanded={tab === 'player'}
          aria-controls="info-sheet-panel-player"
          className={`info-sheet__tab${tab === 'player' ? ' info-sheet__tab--active' : ''}`}
          onClick={() => toggle('player')}
        >
          Player
        </button>
        <button
          type="button"
          role="tab"
          id="info-sheet-tab-log"
          aria-selected={tab === 'log'}
          aria-expanded={tab === 'log'}
          aria-controls="info-sheet-panel-log"
          className={`info-sheet__tab${tab === 'log' ? ' info-sheet__tab--active' : ''}`}
          onClick={() => toggle('log')}
        >
          Rolls{log.length > 0 && <span className="info-sheet__count">{log.length}</span>}
        </button>
      </div>

      {/* Both panels stay mounted so the log keeps its scroll position and the
          tab switch costs no re-render of the board. */}
      <div
        role="tabpanel"
        id="info-sheet-panel-player"
        aria-labelledby="info-sheet-tab-player"
        hidden={tab !== 'player'}
        className="info-sheet__panel info-sheet__panel--player"
      >
        <PlayerPanel piece={piece} side="right" />
      </div>

      <div
        role="tabpanel"
        id="info-sheet-panel-log"
        aria-labelledby="info-sheet-tab-log"
        hidden={tab !== 'log'}
        className="info-sheet__panel info-sheet__panel--log"
      >
        <DiceLog log={log} pendingProb={pendingProb} pendingTargets={pendingTargets} />
      </div>
    </section>
  );
}
