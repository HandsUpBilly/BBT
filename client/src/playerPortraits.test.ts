import { describe, expect, it } from 'vitest';
import { playerPortraitFor } from './playerPortraits';

describe('playerPortraitFor', () => {
  it('never uses the Human tackle status-icon sheet as the Blitzer portrait', () => {
    expect(playerPortraitFor('human', 'blitzer')).toBe('/human-blitzer-gritty.webp');
    expect(playerPortraitFor('human', 'blitzer')).not.toBe('/human-tackle.png');
  });

  it('uses dedicated portraits for the large player roles', () => {
    expect(playerPortraitFor('human', 'ogre')).toBe('/ogre-gritty.webp');
    expect(playerPortraitFor('orc', 'troll')).toBe('/troll-gritty.webp');
    expect(playerPortraitFor('orc', 'big-un')).toBe('/big-un-gritty.webp');
    expect(playerPortraitFor('orc', 'black-orc')).toBe('/black-orc-gritty.webp');
  });

  it('falls back to the team default for roles without dedicated art', () => {
    expect(playerPortraitFor('human', 'halfling')).toBe('/human-lineman-gritty.webp');
    expect(playerPortraitFor('orc', 'goblin')).toBe('/orc-blocker-gritty.webp');
  });
});
