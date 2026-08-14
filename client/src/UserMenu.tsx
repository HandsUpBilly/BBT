import { useCallback, useEffect, useRef, useState } from 'react';
import './UserMenu.css';

interface Props {
  name: string;
  /** A `data:image/...` avatar (see prefs.ts). Falls back to initials when absent or when it fails to load. */
  avatar?: string;
  onSettings?: () => void;
  onAbout?: () => void;
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

/** Renders the avatar image when one is set, falling back to initials on a load error. */
function Avatar({ name, avatar, large }: { name: string; avatar?: string; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const className = `user-menu__avatar${large ? ' user-menu__avatar--lg' : ''}`;
  if (avatar && !failed) {
    // Keyed by the avatar URL so a new upload gets a fresh error state instead
    // of staying stuck showing the previous failure's fallback.
    return <img key={avatar} className={className} src={avatar} alt="" onError={() => setFailed(true)} />;
  }
  return <span className={`${className} user-menu__avatar--fallback`}>{initials(name)}</span>;
}

export function UserMenu({ name, avatar, onSettings, onAbout, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

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
        ref={triggerRef}
        className="user-menu__trigger"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Player menu for ${name}`}
        title={name}
      >
        <Avatar name={name} avatar={avatar} />
        <span className="user-menu__name">{name}</span>
        <span className="user-menu__caret">▾</span>
      </button>

      {open && (
        <div className="user-menu__dropdown" role="menu">
          <div className="user-menu__dropdown-header">
            <Avatar name={name} avatar={avatar} large />
            <span className="user-menu__dropdown-name">{name}</span>
          </div>
          {onSettings && (
            <button
              className="user-menu__item"
              role="menuitem"
              onClick={() => { close(); onSettings(); }}
            >
              Settings
            </button>
          )}
          {onAbout && (
            <button
              className="user-menu__item"
              role="menuitem"
              onClick={() => {
                close();
                // The menu item disappears as the dialog opens. Put focus on
                // the persistent trigger first so useModalFocus can restore it.
                triggerRef.current?.focus();
                onAbout();
              }}
            >
              About
            </button>
          )}
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
