import { describe, expect, it } from 'vitest';
import { PLAYER_ROLES, playerPortraitFor } from './playerPortraits';

describe('playerPortraitFor', () => {
  it('never uses the Human tackle status-icon sheet as the Blitzer portrait', () => {
    expect(playerPortraitFor('human', 'blitzer')).toBe('/human-blitzer-gritty.webp');
    expect(playerPortraitFor('human', 'blitzer')).not.toBe('/human-tackle.png');
  });

  it('gives every selectable editor role its own gritty portrait', () => {
    const portraits = (Object.entries(PLAYER_ROLES) as [keyof typeof PLAYER_ROLES, readonly string[]][])
      .flatMap(([team, roles]) => roles.map(role => playerPortraitFor(team, role)));

    expect(portraits).toHaveLength(18);
    expect(new Set(portraits)).toHaveLength(portraits.length);
    expect(portraits.every(portrait => portrait.endsWith('-gritty.webp'))).toBe(true);
  });
});
