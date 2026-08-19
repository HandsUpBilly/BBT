import { describe, expect, it } from 'vitest';
import { placeMenuBesideAnchor } from './menuPosition';

describe('PieceMenu viewport placement', () => {
  it('places the menu beside the player when the preferred right side fits', () => {
    expect(placeMenuBesideAnchor(
      { left: 100, top: 100, right: 140, bottom: 140 },
      260, 220, 800, 600,
    )).toEqual({ left: 148, top: 10 });
  });

  it('moves to the left of a player near the bottom-right', () => {
    expect(placeMenuBesideAnchor(
      { left: 760, top: 560, right: 790, bottom: 590 },
      260, 220, 800, 600,
    )).toEqual({ left: 492, top: 372 });
  });

  it('uses the space below when a phone has no room on either side', () => {
    expect(placeMenuBesideAnchor(
      { left: 170, top: 200, right: 205, bottom: 235 },
      220, 190, 375, 800,
    )).toEqual({ left: 77.5, top: 243 });
  });
});
