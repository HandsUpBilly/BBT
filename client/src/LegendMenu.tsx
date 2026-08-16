import { useCallback, useEffect, useRef, useState } from 'react';
import { SKILL_GROUPS, SKILL_MARKERS } from './skillPresentation';
import './LegendMenu.css';

interface Props {
  /** Pass bands are only meaningful while a throw is being aimed. */
  isPassTargeting: boolean;
  isBlockTargeting: boolean;
  /** A resolved block waiting on a push-back square. */
  hasPushTargets: boolean;
}

/**
 * The pitch key, opened from the game toolbar.
 *
 * It used to sit permanently under the HUD: two rows of colour chips plus the
 * two skill keys, always on, on every screen. That is reference material — a
 * player reads it once and then plays — and it was charging rent for the whole
 * session in the one dimension the board competes for. Behind a button it costs
 * one control.
 *
 * Follows ActionLogMenu's dropdown pattern (pointerdown outside, Escape,
 * toggle), so the two toolbar panels next to each other behave the same way.
 */
export function LegendMenu({ isPassTargeting, isBlockTargeting, hasPushTargets }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      // Stop the board's own Escape handler cancelling the activation as well —
      // closing a panel should not also throw away the planned move.
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

  // The contextual entries are the ones that appear mid-decision — pass bands
  // while aiming a throw, the block and push-back colours while resolving one.
  // Those used to announce themselves by appearing in a permanently visible
  // row. Behind a button they would just be gone, so the count says the key has
  // something to say about what is happening right now.
  const contextualCount =
    (isPassTargeting ? 4 : 0) + (isBlockTargeting ? 1 : 0) + (hasPushTargets ? 1 : 0);

  return (
    <div className="legend-menu" ref={rootRef}>
      <button
        type="button"
        className={`legend-menu__trigger${open ? ' legend-menu__trigger--active' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          contextualCount > 0
            ? `Key, ${contextualCount} ${contextualCount === 1 ? 'entry' : 'entries'} for the current action`
            : 'Key'
        }
        title="Pitch and skill key"
      >
        <span className="legend-menu__icon" aria-hidden="true">?</span>
        <span className="legend-menu__label">Key</span>
        {contextualCount > 0 && (
          <span className="legend-menu__count" aria-hidden="true">{contextualCount}</span>
        )}
      </button>

      {open && (
        <div className="legend-menu__dropdown" role="dialog" aria-label="Pitch and skill key">
          <div className="game-legends">
            <div className="legend" role="list" aria-label="Pitch state legend">
              <span className="legend__item legend__item--tz" role="listitem">Tackle Zone</span>
              <span className="legend__item legend__item--free" role="listitem">Free Move</span>
              <span className="legend__item legend__item--gfi" role="listitem">Rush: final 2 squares</span>
              <span className="legend__item legend__item--dodge" role="listitem">Dodge Required</span>
              {isPassTargeting && <>
                <span className="legend__item legend__item--pass-range legend__item--range-quick" role="listitem">Quick Pass: 0-3 squares</span>
                <span className="legend__item legend__item--pass-range legend__item--range-short" role="listitem">Short Pass: 4-6 squares</span>
                <span className="legend__item legend__item--pass-range legend__item--range-long" role="listitem">Long Pass: 7-9 squares</span>
                <span className="legend__item legend__item--pass-range legend__item--range-bomb" role="listitem">Long Bomb: 10-13 squares</span>
              </>}
              {isBlockTargeting && (
                <span className="legend__item legend__item--block-target" role="listitem">Block Target</span>
              )}
              {hasPushTargets && (
                <span className="legend__item legend__item--push-target" role="listitem">Push-Back Square</span>
              )}
            </div>

            <div className="skill-keys">
              <div className="legend legend--skill-key" role="list" aria-label="Skill group color key">
                <span className="legend__key-title" aria-hidden="true">Skill groups</span>
                {SKILL_GROUPS.map(group => (
                  <span className="legend__item legend__item--skill" role="listitem" key={group.id}>
                    <span className={`legend__skill-swatch legend__skill-swatch--${group.id}`} aria-hidden="true" />
                    {group.label}
                  </span>
                ))}
              </div>

              <div className="legend legend--skill-key" role="list" aria-label="Exact skill marker key">
                <span className="legend__key-title" aria-hidden="true">Skill markers</span>
                {SKILL_MARKERS.map(marker => (
                  <span className="legend__item legend__item--skill" role="listitem" key={marker.skill}>
                    <span className={`legend__skill-marker legend__skill-marker--${marker.className}`} aria-hidden="true">
                      {marker.letter}
                    </span>
                    {marker.skill}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
