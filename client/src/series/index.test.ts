import { describe, expect, it } from 'vitest';
import { scenarios } from '../scenarios';
import type { SeriesDefinition } from '../types';
import {
  FEATURED_SERIES_LOGO,
  FEATURED_SERIES_LABEL,
  FEATURED_SERIES_NAME,
  defaultSeries,
  normalizeSeriesDefinition,
  applySeriesTeams,
  resolveSeriesScenarios,
} from '.';

describe('Tutorial series', () => {
  it('uses the six Tutorial drills in their authored order', () => {
    expect(defaultSeries.name).toBe(FEATURED_SERIES_NAME);
    expect(resolveSeriesScenarios(defaultSeries, scenarios).map(scenario => scenario.id)).toEqual([
      'scenario-001',
      'scenario-002',
      'scenario-003',
      'scenario-004',
      'scenario-005',
      'scenario-006',
    ]);
  });

  it('migrates known published names without overriding custom series copy', () => {
    expect(normalizeSeriesDefinition({
      ...defaultSeries,
      name: 'Humans vs Orcs: Touchdown or Bust',
    }).name).toBe(FEATURED_SERIES_NAME);
    expect(normalizeSeriesDefinition({ ...defaultSeries, name: 'My League Final' }).name)
      .toBe('My League Final');
  });

  it('keeps the featured crest when runtime metadata predates logo support', () => {
    const normalized = normalizeSeriesDefinition({
      ...defaultSeries,
      logo: undefined,
      label: undefined,
      name: 'Humans vs Orcs: Touchdown or Bust',
    });
    expect(normalized.logo).toBe(FEATURED_SERIES_LOGO);
    expect(normalized.label).toBe(FEATURED_SERIES_LABEL);
  });

  it('preserves native teams and active side for a valid board even in a mixed series', () => {
    const scenario = scenarios.find(item => item.id === 'scenario-001')!;
    const series: SeriesDefinition = {
      ...defaultSeries,
      teams: ['black-orc', 'imperial-nobility'],
      scenarioIds: [scenario.id],
    };

    const resolved = applySeriesTeams(series, scenario);
    expect(resolved.teams).toEqual(['human', 'orc']);
    expect(resolved.activeTeam).toBe('human');
    expect(resolveSeriesScenarios(series, scenarios)[0].pieces).toEqual(scenario.pieces);
  });

  it('uses configured series teams as a fallback for malformed legacy scenarios', () => {
    const scenario = { ...scenarios[0], teams: undefined };
    const series: SeriesDefinition = {
      ...defaultSeries,
      teams: ['black-orc', 'imperial-nobility'],
      scenarioIds: [scenario.id],
    };
    expect(applySeriesTeams(series, scenario).teams).toEqual(['black-orc', 'imperial-nobility']);
  });

  it('keeps both Reikland and Imperial Nobility active rosters playable in Series 2', () => {
    const secondSeries = {
      ...defaultSeries,
      teams: ['imperial-nobility', 'black-orc'] as SeriesDefinition['teams'],
      scenarioIds: ['scenario-007', 'blood-feud-01', 'blood-feud-04', 'blood-feud-05', 'blood-feud-06'],
    };
    const resolved = resolveSeriesScenarios(secondSeries, scenarios);
    expect(resolved).toHaveLength(secondSeries.scenarioIds.length);
    for (const puzzle of resolved) {
      expect(puzzle.pieces.some(piece => piece.team === puzzle.activeTeam)).toBe(true);
      expect(puzzle.pieces.every(piece => puzzle.teams?.includes(piece.team))).toBe(true);
    }
    expect(resolved.find(puzzle => puzzle.id === 'blood-feud-01')?.activeTeam).toBe('human');
    expect(resolved.find(puzzle => puzzle.id === 'scenario-007')?.activeTeam).toBe('imperial-nobility');
  });
});
