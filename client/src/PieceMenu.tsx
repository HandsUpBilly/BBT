import { useEffect, useRef, useState } from 'react';
import type { PlayerPiece } from './types';
import './PieceMenu.css';

export interface PieceMenuAction {
  label: string;
  key: string;
  disabled?: boolean;
}

interface Props {
  piece: PlayerPiece;
  x: number; // px from left of viewport
  y: number; // px from top of viewport
  actions: PieceMenuAction[];
  // `moveFirst` reflects whether the "Move" checkbox was also checked
  // alongside the chosen action — irrelevant for a plain 'move', but tells
  // the caller whether a 'pass'/'handoff' should move the carrier first or
  // go straight to targeting from its current square.
  onAction: (key: string, moveFirst: boolean) => void;
  onDismiss: () => void;
}

const ACTIONS: PieceMenuAction[] = [
  { label: 'Move', key: 'move' },
  { label: 'Hand Off', key: 'handoff' },
  { label: 'Pass', key: 'pass' },
  { label: 'Block', key: 'block' },
  { label: 'Blitz', key: 'blitz' },
];

export { ACTIONS as DEFAULT_ACTIONS };

// A piece may take exactly one of these actions per activation — checking
// one unchecks the others. (Move stays independent: it combines with any
// of these, e.g. "Blitz" + "Move" moves before the block is thrown.)
const EXCLUSIVE_KEYS = ['pass', 'handoff', 'block', 'blitz'];

export function PieceMenu({ piece, x, y, actions, onAction, onDismiss }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Dismiss on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    // Use capture so it fires before any other click handlers
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [onDismiss]);

  // Dismiss on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onDismiss]);

  const toggle = (actionKey: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(actionKey)) {
        next.delete(actionKey);
      } else {
        if (EXCLUSIVE_KEYS.includes(actionKey)) {
          for (const exclusiveKey of EXCLUSIVE_KEYS) {
            if (exclusiveKey !== actionKey) next.delete(exclusiveKey);
          }
        }
        next.add(actionKey);
      }
      return next;
    });
  };

  // Pass/Hand Off/Block/Blitz imply movement to the target (Blitz uses the
  // Move checkbox to decide whether to move first), so any of them takes
  // priority over a plain Move when both are selected.
  const chosenAction = selected.has('pass')
    ? 'pass'
    : selected.has('handoff')
      ? 'handoff'
      : selected.has('blitz')
        ? 'blitz'
        : selected.has('block')
          ? 'block'
          : selected.has('move')
            ? 'move'
            : null;

  return (
    <div
      ref={ref}
      className="piece-menu"
      style={{ left: x, top: y }}
    >
      <div className="piece-menu__header">{piece.name}</div>
      {actions.map(action => {
        const isExclusiveLockedOut = EXCLUSIVE_KEYS.includes(action.key)
          && !selected.has(action.key)
          && EXCLUSIVE_KEYS.some(k => k !== action.key && selected.has(k));
        const isDisabled = action.disabled || isExclusiveLockedOut;
        return (
          <label
            key={action.key}
            className={['piece-menu__item', isDisabled ? 'piece-menu__item--disabled' : ''].filter(Boolean).join(' ')}
          >
            <input
              type="checkbox"
              className="piece-menu__checkbox"
              checked={selected.has(action.key)}
              disabled={isDisabled}
              onChange={() => toggle(action.key)}
            />
            {action.label}
          </label>
        );
      })}
      <button
        className="piece-menu__confirm"
        disabled={!chosenAction}
        onClick={() => { if (chosenAction) onAction(chosenAction, selected.has('move')); }}
      >
        Confirm
      </button>
    </div>
  );
}
