import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useHoverCapable } from './useMediaQuery';

const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');

afterEach(() => {
  if (originalMatchMedia) {
    Object.defineProperty(window, 'matchMedia', originalMatchMedia);
  } else {
    Reflect.deleteProperty(window, 'matchMedia');
  }
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
