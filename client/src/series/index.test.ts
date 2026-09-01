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
  it('uses the six Tutorial drills in rules order', () => {
    expect(defaultSeries.name).toBe(FEATURED_SERIES_NAME);
    expect(resolveSeriesScenarios(defaultSeries, scenarios).map(scenario => scenario.id)).toEqual([
      'scenario-001',
      'scenario-004',
      'scenario-002',
      'scenario-003',
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

  it('uses the selected series teams for every puzzle in the run', () => {
    const scenario = scenarios[0];
    const series: SeriesDefinition = {
      ...defaultSeries,
      teams: ['black-orc', 'imperial-nobility'],
      scenarioIds: [scenario.id],
    };

    expect(applySeriesTeams(series, scenario).teams).toEqual(['black-orc', 'imperial-nobility']);
    expect(resolveSeriesScenarios(series, scenarios)[0].teams).toEqual(['black-orc', 'imperial-nobility']);
    expect(resolveSeriesScenarios(series, scenarios)[0].activeTeam).toBe('black-orc');
  });
});
