import { useCallback, useEffect, useRef, useState } from 'react';
import './GameToolsMenu.css';

interface Props {
  zoomEnabled: boolean;
  onToggleZoom: () => void;
  onRestart: () => void;
  onReport: () => void;
}

export function GameToolsMenu({ zoomEnabled, onToggleZoom, onRestart, onReport }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open, close]);

  const run = (action: () => void) => {
    close();
    action();
  };

  return (
    <div className="game-tools-menu" ref={rootRef}>
      <button
        type="button"
        className={`game-tools-menu__trigger${open ? ' game-tools-menu__trigger--active' : ''}`}
        aria-label="Game tools"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <span aria-hidden="true">•••</span>
      </button>
      {open && (
        <div className="game-tools-menu__dropdown" role="menu" aria-label="Game tools">
          <button type="button" role="menuitem" onClick={() => run(onToggleZoom)}>
            {zoomEnabled ? 'Show whole pitch' : 'Zoom to legal moves'}
          </button>
          <button type="button" role="menuitem" onClick={() => run(onRestart)}>
            Restart turn
          </button>
          <button type="button" role="menuitem" onClick={() => run(onReport)}>
            Report a problem
          </button>
        </div>
      )}
    </div>
  );
}
