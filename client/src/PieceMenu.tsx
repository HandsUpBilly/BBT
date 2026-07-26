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
  onAction: (key: string) => void;
  onDismiss: () => void;
}

const ACTIONS: PieceMenuAction[] = [
  { label: 'Move', key: 'move' },
  { label: 'Hand Off', key: 'handoff' },
  { label: 'Pass', key: 'pass' },
];

export { ACTIONS as DEFAULT_ACTIONS };

// A carrier may Move and then either Pass or Hand Off, but never both in the
// same activation — checking one unchecks the other.
const EXCLUSIVE_KEYS = ['pass', 'handoff'];

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

  // Pass/Hand Off imply movement to the target, so either takes priority
  // over a plain Move when both are selected.
  const chosenAction = selected.has('pass')
    ? 'pass'
    : selected.has('handoff')
      ? 'handoff'
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
        onClick={() => { if (chosenAction) onAction(chosenAction); }}
      >
        Confirm
      </button>
    </div>
  );
}
