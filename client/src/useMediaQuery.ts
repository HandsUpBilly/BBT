import { useCallback, useSyncExternalStore } from 'react';

/**
 * Subscribes to a CSS media query.
 *
 * Used for the layout decisions JavaScript has to make too, so the
 * breakpoints stay in one vocabulary with the stylesheets rather than being
 * re-guessed from window.innerWidth.
 *
 * useSyncExternalStore rather than useState + useEffect: matchMedia is an
 * external store, and reading it through the proper primitive means the first
 * render already has the right answer.
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
 * Three independent questions, three queries. Answering any of them with the
 * wrong one produces a real defect, and this codebase has now shipped two:
 *
 *   - Deciding layout by width alone called a phone held sideways (812px) a
 *     desktop, and 40% of the board rendered outside a clipped container.
 *   - Deciding layout by pointer alone gave a 1280px touchscreen the phone
 *     layout: side columns hidden, ~740px of empty space beside a small
 *     board, and no hover preview on a machine perfectly able to hover.
 *
 * Size, precision and hover are not proxies for each other. Keep them apart.
 */

/**
 * Is there room for the full three-column layout?
 *
 * A space question, so it takes a size query — regardless of input device.
 * Below this the side columns squeeze the board harder than they are worth:
 * they cost at least 320px, so at 1024px the board still gets ~27px squares
 * and at 768px only ~16px.
 *
 * Keep in sync with the same breakpoint in App.css / PlaybookTheme.css.
 */
export const COMPACT_MAX_WIDTH = 1024;

export function useCompactLayout(): boolean {
  return useMediaQuery(`(max-width: ${COMPACT_MAX_WIDTH}px)`);
}

/**
 * Can any available input hover?
 *
 * A touchscreen laptop often reports touch as its primary input even while a
 * trackpad or mouse is connected. `(hover: hover)` would turn off cursor
 * previews in that case. This, not "is it a phone", is what decides whether
 * the path preview can follow a cursor. Only devices with no hovering input
 * need the two-stage tap, because for them preview and commit would otherwise
 * land in the same gesture.
 */
export function useHoverCapable(): boolean {
  return useMediaQuery('(any-hover: hover)');
}

/**
 * Is the primary pointer imprecise?
 *
 * Governs hit-target sizing only. A fingertip does not get more precise
 * because the screen got bigger, so this is deliberately independent of
 * useCompactLayout.
 */
export function useCoarsePointer(): boolean {
  return useMediaQuery('(pointer: coarse)');
}

/** True when the viewport is taller than it is wide. */
export function usePortraitViewport(): boolean {
  return useMediaQuery('(orientation: portrait)');
}
