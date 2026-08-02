import { describe, it, expect } from 'vitest';
import { nextScenarioId, validateScenarioDraft } from './editorValidation';
import { resolveSeriesScenarios } from '../series';
import type { Scenario } from '../types';

function draft(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 'scenario-006',
    name: 'Test Puzzle',
    description: 'A puzzle for tests.',
    activeTeam: 'human',
    published: true,
    ballPosition: null,
    pieces: [
      {
        id: 'human-1', team: 'human', role: 'thrower', name: 'Aldric',
        ma: 6, st: 3, ag: 3, pa: 3, av: 8, skills: [],
        position: { col: 7, row: 10 }, hasBall: true,
      },
    ],
    ...overrides,
  };
}

describe('validateScenarioDraft', () => {
  it('accepts a valid draft', () => {
    expect(validateScenarioDraft(draft(), [])).toEqual([]);
  });

  it('catches out-of-range stats — the editor used to accept these silently', () => {
    // Previously the client validator skipped stat ranges entirely, so a
    // designer saw a clean error list and then got a 400 from the server.
    const errors = validateScenarioDraft(
      draft({ pieces: [{ ...draft().pieces[0], st: 20 }] }),
      [],
    );
    expect(errors.some(e => e.includes('ST must be between 1 and 12'))).toBe(true);
  });

  it('coerces an unknown team to human rather than saving it', () => {
    // Normalization runs before validation on both the client and the server,
    // so an unrecognized team can never reach storage.
    const errors = validateScenarioDraft(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      draft({ activeTeam: 'elf' as any }),
      [],
    );
    expect(errors).toEqual([]);
  });

  it('rejects a draft with no player on the active team', () => {
    const errors = validateScenarioDraft(draft({ activeTeam: 'orc' }), []);
    expect(errors).toContain('At least one player must belong to the active team');
  });

  it('flags a duplicate id but exempts the puzzle being edited', () => {
    expect(validateScenarioDraft(draft(), ['scenario-006'])).toContain('Scenario id already exists');
    expect(validateScenarioDraft(draft(), ['scenario-006'], 'scenario-006')).toEqual([]);
  });

  it('requires exactly one ball', () => {
    expect(validateScenarioDraft(draft({ ballPosition: { col: 1, row: 1 } }), []))
      .toContain('Ball can be carried or loose, not both');
    expect(validateScenarioDraft(
      draft({ pieces: [{ ...draft().pieces[0], hasBall: false }] }),
      [],
    )).toContain('Place the ball on a player or on the ground');
  });
});

describe('nextScenarioId', () => {
  it('pads to three digits and skips taken ids', () => {
    expect(nextScenarioId([])).toBe('scenario-001');
    expect(nextScenarioId(['scenario-001', 'scenario-002'])).toBe('scenario-003');
    // Non-sequential ids must not produce a collision.
    expect(nextScenarioId(['a', 'scenario-002'])).toBe('scenario-003');
  });
});

describe('resolveSeriesScenarios', () => {
  const scenarios = [draft({ id: 'a' }), draft({ id: 'b' }), draft({ id: 'c' })];

  it('resolves in series order, not scenario order', () => {
    const series = { id: 'default', name: 'S', description: '', scenarioIds: ['c', 'a'] };
    expect(resolveSeriesScenarios(series, scenarios).map(s => s.id)).toEqual(['c', 'a']);
  });

  it('skips ids that no longer resolve', () => {
    const series = { id: 'default', name: 'S', description: '', scenarioIds: ['a', 'gone', 'b'] };
    expect(resolveSeriesScenarios(series, scenarios).map(s => s.id)).toEqual(['a', 'b']);
  });
});
