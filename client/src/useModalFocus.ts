import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Traps Tab inside a dialog, restores focus to whatever opened it, and wires
 * Escape to `onClose`.
 *
 * The modals declared `role="dialog" aria-modal="true"` but let Tab walk
 * straight into the page behind them, which makes the dialog unusable with a
 * keyboard or screen reader.
 *
 * @param onClose omit for dialogs that must be dismissed via an explicit choice
 */
export function useModalFocus<T extends HTMLElement>(onClose?: () => void) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const container = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus the first control, or the dialog itself if it has none.
    const focusables = () => Array.from(container?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    const initial = focusables()[0] ?? container;
    initial?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onClose) {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !container) return;

      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      // Wrap at both ends, and pull focus back in if it escaped the dialog.
      if (event.shiftKey && (active === first || !container.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !container.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      // Return focus to the launcher so keyboard users don't land at the top
      // of the document after closing.
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return ref;
}
