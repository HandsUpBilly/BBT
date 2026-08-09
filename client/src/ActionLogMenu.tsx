import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActionLogEntry } from './types';
import { DiceLog } from './DiceLog';
import { rollCount } from './actionLogDisplay';
import './ActionLogMenu.css';

interface Props {
  log: ActionLogEntry[];
}

/**
 * The action log, opened from the game toolbar.
 *
 * On touch this used to be a tab in a sheet under the board, which put it
 * furthest from the controls it belongs with and cost permanent height even
 * while closed. As a toolbar dropdown it costs one button, and the badge
 * gives the thing players actually want at a glance — how many rolls this
 * line has ridden on — without opening anything.
 *
 * Follows UserMenu's dropdown pattern (pointerdown outside, Escape, toggle)
 * so the two controls sitting next to each other behave the same way.
 */
export function ActionLogMenu({ log }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      // Stop the board's own Escape handler cancelling the activation as
      // well — closing a panel should not also throw away the planned move.
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
    }
    window.addEventListener('pointerdown', onPointerDown);
    // Capture, so this runs before the window-level Escape in App.
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open, close]);

  const rolls = rollCount(log);

  return (
    <div className="action-log-menu" ref={rootRef}>
      <button
        type="button"
        className={`action-log-menu__trigger${open ? ' action-log-menu__trigger--active' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={rolls > 0 ? `Action log, ${rolls} rolls` : 'Action log'}
        title="Action log"
      >
        <span className="action-log-menu__icon" aria-hidden="true">🎲</span>
        <span className="action-log-menu__label">Action Log</span>
        {rolls > 0 && <span className="action-log-menu__count" aria-hidden="true">{rolls}</span>}
      </button>

      {open && (
        <div className="action-log-menu__dropdown" role="dialog" aria-label="Action log">
          {/* DiceLog carries its own empty state, so there is one wording for
              "nothing yet" rather than two that can drift. */}
          <DiceLog log={log} />
        </div>
      )}
    </div>
  );
}
