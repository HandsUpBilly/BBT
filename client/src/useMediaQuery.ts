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

/**
 * Safari can expose an iPhone as a 980px CSS viewport when the user has
 * "Request Desktop Website" enabled. That is not physical space for the game
 * rails, so retain the compact layout for iPhone/iPod handsets in that mode.
 * iPads and touch desktops deliberately remain size-driven.
 */
export function isIOSHandsetUserAgent(userAgent: string): boolean {
  return /\b(iPhone|iPod)\b/i.test(userAgent);
}

export function useCompactLayout(): boolean {
  const compactBySize = useMediaQuery(`(max-width: ${COMPACT_MAX_WIDTH}px)`);
  const compactByHandset = typeof navigator !== 'undefined'
    && isIOSHandsetUserAgent(navigator.userAgent);
  return compactBySize || compactByHandset;
}

/**
 * Safari's desktop-website setting may keep an iPhone's layout viewport at
 * 980px while visualViewport reports the physical phone width. Return the
 * correction factor needed to render the game at the physical scale.
 */
export function iOSDesktopViewportScale(layoutWidth: number, visualWidth: number): number {
  if (!Number.isFinite(layoutWidth) || !Number.isFinite(visualWidth) || visualWidth <= 0) return 1;
  return Math.min(3, Math.max(1, layoutWidth / visualWidth));
}

export function useIOSHandsetViewportScale(): number {
  const subscribe = useCallback((onChange: () => void) => {
    if (typeof window === 'undefined') return () => {};
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', onChange);
    window.addEventListener('resize', onChange);
    return () => {
      viewport?.removeEventListener('resize', onChange);
      window.removeEventListener('resize', onChange);
    };
  }, []);
  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined' || !isIOSHandsetUserAgent(navigator.userAgent)) return 1;
    const visualWidth = Math.min(
      window.visualViewport?.width ?? window.innerWidth,
      window.screen?.width ?? window.innerWidth,
    );
    return iOSDesktopViewportScale(window.innerWidth, visualWidth);
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot, () => 1);
}

/**
 * Can any available input hover?
 *
 * A touchscreen laptop often reports touch as its primary input even while a
 * trackpad or mouse is connected. `(hover: hover)` would turn off cursor
 * previews in that case. This, not "is it a phone", is what decides whether
 * the path preview can follow a cursor. Devices without one plot from their
 * first tap; both interaction styles still require the same explicit move
 * confirmation.
 */
export function useHoverCapable(): boolean {
  return useMediaQuery('(any-hover: hover)');
}

/**
 * The third axis — pointer precision — has no hook on purpose. It settles
 * hit-target sizing, which is a `(pointer: coarse)` media query in the
 * stylesheets and nothing else; no component branches on it. A hook here
 * would be an invitation to reintroduce the JS-branches-on-pointer coupling
 * the note above records two shipped defects from. See the three-axis table
 * in docs/agent-context/frontend-flow.md.
 */

/** True when the viewport is taller than it is wide. */
export function usePortraitViewport(): boolean {
  return useMediaQuery('(orientation: portrait)');
}
