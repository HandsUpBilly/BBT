import { describe, expect, it } from 'vitest';
import { PLAYER_ROLES, playerPortraitFor } from './playerPortraits';

describe('playerPortraitFor', () => {
  it('never uses the Human tackle status-icon sheet as the Blitzer portrait', () => {
    expect(playerPortraitFor('human', 'blitzer')).toBe('/human-blitzer-gritty.webp');
    expect(playerPortraitFor('human', 'blitzer')).not.toBe('/human-tackle.png');
    expect(playerPortraitFor('orc', 'troll')).toBe('/troll-v3-gritty.webp');
  });

  it('keeps the original Human and Orc editor roles on dedicated gritty portraits', () => {
    const portraits = (Object.entries(PLAYER_ROLES) as [keyof typeof PLAYER_ROLES, readonly string[]][])
      .filter(([team]) => team === 'human' || team === 'orc')
      .flatMap(([team, roles]) => roles.map(role => playerPortraitFor(team, role)));

    expect(portraits).toHaveLength(18);
    expect(new Set(portraits)).toHaveLength(portraits.length);
    expect(portraits.every(portrait => portrait.endsWith('-gritty.webp'))).toBe(true);
  });

  it('gives every new-team role a safe, gritty portrait fallback', () => {
    const portraits = (Object.entries(PLAYER_ROLES) as [keyof typeof PLAYER_ROLES, readonly string[]][])
      .filter(([team]) => team === 'black-orc' || team === 'imperial-nobility')
      .flatMap(([team, roles]) => roles.map(role => playerPortraitFor(team, role)));

    expect(portraits).toHaveLength(8);
    expect(portraits.every(portrait => portrait.endsWith('-gritty.webp'))).toBe(true);
  });
});
