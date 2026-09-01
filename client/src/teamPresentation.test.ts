import { describe, expect, it } from 'vitest';
import {
  attacksTopEndZone,
  resolveEndZoneTeams,
  TEAMS,
  teamAccentRgb,
  teamIconSource,
  teamLabel,
  teamPluralLabel,
} from './teamPresentation';

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

  it('maps the actual matchup to end-zone sides and dedicated icons', () => {
    expect(resolveEndZoneTeams(['black-orc', 'imperial-nobility'])).toEqual({
      top: 'imperial-nobility',
      bottom: 'black-orc',
    });
    expect(teamIconSource('black-orc')).toBe('/orc-black-orc.png');
    expect(teamIconSource('imperial-nobility')).toBe('/imperial-noble-blitzer-gritty.webp');
  });

  it('provides a distinct CSS accent for every team', () => {
    const accents = TEAMS.map(teamAccentRgb);
    expect(new Set(accents).size).toBe(accents.length);
  });
});
