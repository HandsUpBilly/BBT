import { describe, expect, it } from 'vitest';
import { clampMenuPosition } from './menuPosition';

describe('PieceMenu viewport placement', () => {
  it('moves a menu opened near the bottom-right fully inside the viewport', () => {
    expect(clampMenuPosition(790, 590, 260, 220, 800, 600)).toEqual({ left: 532, top: 372 });
  });

  it('preserves a viewport gap at the top-left', () => {
    expect(clampMenuPosition(-20, -10, 260, 220, 800, 600)).toEqual({ left: 8, top: 8 });
  });
});
