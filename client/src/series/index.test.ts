import { describe, expect, it } from 'vitest';
import { scenarios } from '../scenarios';
import {
  FEATURED_SERIES_LOGO,
  FEATURED_SERIES_NAME,
  defaultSeries,
  normalizeSeriesDefinition,
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
    expect(normalizeSeriesDefinition({
      ...defaultSeries,
      logo: undefined,
      name: 'Humans vs Orcs: Touchdown or Bust',
    }).logo).toBe(FEATURED_SERIES_LOGO);
  });
});
