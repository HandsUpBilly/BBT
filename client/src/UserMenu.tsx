import { useCallback, useEffect, useRef, useState } from 'react';
import './UserMenu.css';

interface Props {
  name: string;
  avatarUrl?: string;
  onSignOut?: () => void;
}

function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase();
}

export function UserMenu({ name, avatarUrl, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        className="user-menu__trigger"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={name}
      >
        {avatarUrl ? (
          <img className="user-menu__avatar" src={avatarUrl} alt={name} referrerPolicy="no-referrer" />
        ) : (
          <span className="user-menu__avatar user-menu__avatar--fallback">{initials(name)}</span>
        )}
        <span className="user-menu__name">{name}</span>
        <span className="user-menu__caret">▾</span>
      </button>

      {open && (
        <div className="user-menu__dropdown" role="menu">
          <div className="user-menu__dropdown-header">
            {avatarUrl ? (
              <img className="user-menu__avatar user-menu__avatar--lg" src={avatarUrl} alt={name} referrerPolicy="no-referrer" />
            ) : (
              <span className="user-menu__avatar user-menu__avatar--lg user-menu__avatar--fallback">{initials(name)}</span>
            )}
            <span className="user-menu__dropdown-name">{name}</span>
          </div>
          <button className="user-menu__item" role="menuitem" disabled title="Coming soon">
            Settings
          </button>
          {onSignOut && (
            <button
              className="user-menu__item user-menu__item--danger"
              role="menuitem"
              onClick={() => { close(); onSignOut(); }}
            >
              Log Out
            </button>
          )}
        </div>
      )}
    </div>
  );
}
