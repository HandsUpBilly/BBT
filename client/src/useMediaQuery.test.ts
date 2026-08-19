import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isIOSHandsetUserAgent, useCompactLayout, useHoverCapable } from './useMediaQuery';

const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
const originalUserAgent = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');

afterEach(() => {
  if (originalMatchMedia) {
    Object.defineProperty(window, 'matchMedia', originalMatchMedia);
  } else {
    Reflect.deleteProperty(window, 'matchMedia');
  }
  if (originalUserAgent) Object.defineProperty(window.navigator, 'userAgent', originalUserAgent);
});

describe('isIOSHandsetUserAgent', () => {
  it('recognizes iPhone desktop-website mode without treating iPads or desktops as phones', () => {
    expect(isIOSHandsetUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_1_1 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1')).toBe(true);
    expect(isIOSHandsetUserAgent('Mozilla/5.0 (iPad; CPU OS 18_7 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1')).toBe(false);
    expect(isIOSHandsetUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36')).toBe(false);
  });
});

describe('useCompactLayout', () => {
  it('uses compact game layout for an iPhone that reports a desktop viewport', () => {
    const matchMedia = vi.fn((): MediaQueryList => ({
      matches: false, media: '(max-width: 1024px)', onchange: null,
      addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    }));
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: matchMedia });
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_1_1 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
    });

    const { result } = renderHook(() => useCompactLayout());
    expect(result.current).toBe(true);
  });
});

describe('useHoverCapable', () => {
  it('keeps cursor previews available when touch is primary but a mouse can hover', () => {
    const matchMedia = vi.fn((query: string): MediaQueryList => ({
      matches: query === '(any-hover: hover)',
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }));
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: matchMedia });

    const { result } = renderHook(() => useHoverCapable());

    expect(result.current).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith('(any-hover: hover)');
    expect(matchMedia).not.toHaveBeenCalledWith('(hover: hover)');
  });
});
