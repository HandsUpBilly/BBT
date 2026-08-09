import { useCallback, useSyncExternalStore } from 'react';

/**
 * Subscribes to a CSS media query.
 *
 * Used for the layout decisions JavaScript has to make too — which way to
 * draw the board, whether to default zoom on — so the breakpoints stay in one
 * vocabulary with the stylesheets rather than being re-guessed from
 * window.innerWidth.
 *
 * useSyncExternalStore rather than useState + useEffect: matchMedia is an
 * external store, and reading it through the proper primitive means the first
 * render already has the right answer. Callers can derive from it directly
 * instead of correcting themselves in an effect afterwards.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return () => {};
    }
    const list = window.matchMedia(query);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(query).matches;
  }, [query]);

  // Server snapshot: jsdom in the vitest suite has no matchMedia, and there is
  // no SSR here, so "not matching" is the honest default.
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/**
 * True on touch-primary devices.
 *
 * The mobile layout used to branch on `max-width: 768px`, which treats a
 * phone held sideways (812px wide) as a desktop — that is how the landscape
 * board ended up clipped and the side panels came back on a 375px-tall
 * screen. Pointer type is what those branches actually meant.
 */
export function useCoarsePointer(): boolean {
  return useMediaQuery('(pointer: coarse)');
}

/** True when the viewport is taller than it is wide. */
export function usePortraitViewport(): boolean {
  return useMediaQuery('(orientation: portrait)');
}
