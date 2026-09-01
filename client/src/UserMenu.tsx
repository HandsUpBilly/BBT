import { useCallback, useEffect, useRef, useState } from 'react';
import { PlayerAvatar } from './PlayerAvatar';
import './UserMenu.css';

interface Props {
  name: string;
  /** Public avatar URL, with a legacy local data URL used only until migrated. */
  avatar?: string;
  country?: string;
  onHelp?: () => void;
  onSettings?: () => void;
  onAbout?: () => void;
  onContact?: () => void;
  onReport?: () => void;
  onSignOut?: () => void;
}

/** Renders the avatar image when one is set, falling back to initials on a load error. */
function Avatar({ name, avatar, large }: { name: string; avatar?: string; large?: boolean }) {
  const className = `user-menu__avatar${large ? ' user-menu__avatar--lg' : ''}`;
  return <PlayerAvatar name={name} src={avatar} className={className} fallbackClassName="user-menu__avatar--fallback" />;
}

export function UserMenu({ name, avatar, country, onHelp, onSettings, onAbout, onContact, onReport, onSignOut }: Props) {
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
            <span>
              <span className="user-menu__dropdown-name">{name}</span>
              {country && <span className="user-menu__dropdown-country">{country}</span>}
            </span>
          </div>
          {onHelp && (
            <button
              className="user-menu__item"
              role="menuitem"
              onClick={() => { close(); onHelp(); }}
            >
              Help &amp; rules
            </button>
          )}
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
          {onContact && (
            <button
              className="user-menu__item"
              role="menuitem"
              onClick={() => {
                close();
                // Same reasoning as About above: focus the persistent trigger
                // first so useModalFocus can restore it once the dialog closes.
                triggerRef.current?.focus();
                onContact();
              }}
            >
              Contact us
            </button>
          )}
          {onReport && (
            <button
              className="user-menu__item"
              role="menuitem"
              onClick={() => {
                close();
                triggerRef.current?.focus();
                onReport();
              }}
            >
              Report an issue
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
