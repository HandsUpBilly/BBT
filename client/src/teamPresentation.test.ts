import { describe, expect, it } from 'vitest';
import { attacksTopEndZone, teamLabel, teamPluralLabel } from './teamPresentation';

describe('team presentation', () => {
  it('labels the added rosters for editor and player-facing screens', () => {
    expect(teamLabel('black-orc')).toBe('Black Orc');
    expect(teamPluralLabel('black-orc')).toBe('Black Orcs');
    expect(teamLabel('imperial-nobility')).toBe('Imperial Nobility');
  });

  it('keeps allied team families attacking consistent end zones', () => {
    expect(attacksTopEndZone('human')).toBe(true);
    expect(attacksTopEndZone('imperial-nobility')).toBe(true);
    expect(attacksTopEndZone('orc')).toBe(false);
    expect(attacksTopEndZone('black-orc')).toBe(false);
  });
});
