import { describe, expect, it } from 'vitest';
import { scenarios } from '../scenarios';
import { defaultSeries, resolveSeriesScenarios } from '.';

describe('Tutorial series', () => {
  it('uses the progressive six-puzzle order', () => {
    expect(defaultSeries.name).toBe('Tutorial');
    expect(resolveSeriesScenarios(defaultSeries, scenarios).map(scenario => scenario.id)).toEqual([
      'scenario-001',
      'scenario-004',
      'scenario-002',
      'scenario-003',
      'scenario-005',
      'scenario-006',
    ]);
  });
});
