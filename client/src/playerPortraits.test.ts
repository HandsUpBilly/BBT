import { describe, expect, it } from 'vitest';
import { playerPortraitFor } from './playerPortraits';

describe('playerPortraitFor', () => {
  it('never uses the Human tackle status-icon sheet as the Blitzer portrait', () => {
    expect(playerPortraitFor('human', 'blitzer')).toBe('/human-lineman-gritty.webp');
    expect(playerPortraitFor('human', 'blitzer')).not.toBe('/human-tackle.png');
  });

  it('falls back to the team default for roles without dedicated art', () => {
    expect(playerPortraitFor('human', 'ogre')).toBe('/human-lineman-gritty.webp');
    expect(playerPortraitFor('orc', 'troll')).toBe('/orc-blocker-gritty.webp');
  });
});
