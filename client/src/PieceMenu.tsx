import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PlayerPiece } from './types';
import { placeMenuBesideAnchor } from './menuPosition';
import type { MenuAnchor } from './menuPosition';
import './PieceMenu.css';

export interface PieceMenuAction {
  label: string;
  key: string;
  disabled?: boolean;
}

interface Props {
  piece: PlayerPiece;
  anchor: MenuAnchor;
  actions: PieceMenuAction[];
  // `moveFirst` reflects whether the "Move" checkbox was also checked.
  // Pass/Hand Off use it to choose movement-first vs immediate targeting;
  // Blitz always owns its target-first movement sequence.
  onAction: (key: string, moveFirst: boolean) => void;
  onDismiss: () => void;
}

const ACTIONS: PieceMenuAction[] = [
  { label: 'Move', key: 'move' },
  { label: 'Hand-off', key: 'handoff' },
  { label: 'Pass', key: 'pass' },
  { label: 'Block', key: 'block' },
  { label: 'Blitz', key: 'blitz' },
];

export { ACTIONS as DEFAULT_ACTIONS };

// A piece may take exactly one of these actions per activation — checking
// one unchecks the others. Move stays independent for Pass and Hand Off;
// Blitz always permits movement after its target is chosen.
const EXCLUSIVE_KEYS = ['pass', 'handoff', 'block', 'blitz'];

export function PieceMenu({ piece, anchor, actions, onAction, onDismiss }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [position, setPosition] = useState({ left: anchor.right + 8, top: anchor.top });

  useLayoutEffect(() => {
    const placeMenu = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      setPosition(placeMenuBesideAnchor(
        anchor,
        rect.width,
        rect.height,
        window.innerWidth,
        window.innerHeight,
      ));
    };
    placeMenu();
    window.addEventListener('resize', placeMenu);
    return () => window.removeEventListener('resize', placeMenu);
  }, [anchor]);

  // Dismiss on outside press. pointerdown rather than mousedown so touch is
  // handled first-hand rather than via the synthesised mouse event, matching
  // UserMenu. Capture, so it runs before any other press handler.
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      // A higher-priority modal may explain the action menu while it remains
      // open underneath. Interacting with that dialog must not count as an
      // outside press on the menu; closing the coach should reveal the same
      // choices the player was just shown.
      if (e.target instanceof Element && e.target.closest('[role="dialog"]')) return;
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    document.addEventListener('pointerdown', handler, true);
    return () => document.removeEventListener('pointerdown', handler, true);
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

  // Pass/Hand Off/Block/Blitz take priority over plain Move when selected.
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
      style={position}
    >
      <div className="piece-menu__header">
        <span className="piece-menu__identity">
          <strong>{piece.name}</strong>
          <small>{piece.role ?? 'Lineman'}</small>
        </span>
        <span className="piece-menu__stats" aria-label={`${piece.name} stats`}>
          <span><b>MA</b> {piece.ma}</span>
          <span><b>ST</b> {piece.st}</span>
          <span><b>AG</b> {piece.ag}+</span>
          <span><b>PA</b> {piece.pa}+</span>
          <span><b>AV</b> {piece.av}+</span>
        </span>
      </div>
      <div className="piece-menu__actions">
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
      </div>
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
