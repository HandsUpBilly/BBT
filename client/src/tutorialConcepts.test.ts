import { describe, expect, it } from 'vitest';
import { scenarios } from './scenarios';
import { makeScenarioState } from './useGameState';
import {
  TUTORIAL_CONCEPTS,
  tutorialConceptStatusLabel,
  tutorialConceptsForScenario,
  tutorialConceptsUsed,
} from './tutorialConcepts';

describe('Tutorial concepts', () => {
  it('keeps Parallel Universes as the only blocking concept', () => {
    expect(TUTORIAL_CONCEPTS.filter(concept => concept.mode === 'interrupt').map(concept => concept.id))
      .toEqual(['parallel-universes']);
  });

  it('keeps requested-only concepts manual', () => {
    const manual = TUTORIAL_CONCEPTS.filter(concept => concept.mode === 'manual').map(concept => concept.id);
    expect(manual).toEqual(expect.arrayContaining(['tackle-zones', 'dodging', 'handoff', 'pickup']));
  });

  it('provides a concept library for every Tutorial drill', () => {
    for (const scenario of scenarios.slice(0, 6)) {
      expect(tutorialConceptsForScenario(scenario.id).length).toBeGreaterThan(0);
    }
  });

  it('promotes concepts from committed game actions', () => {
    const state = makeScenarioState(scenarios.find(scenario => scenario.id === 'scenario-001')!);
    state.actionLog = [{
      kind: 'move', pieceName: 'Sera', pieceRole: 'catcher',
      from: { col: 7, row: 10 }, to: { col: 7, row: 9 }, steps: 1,
      dodgeTarget: 3, isGfi: false, actionProb: 2 / 3, cumulativeProb: 2 / 3,
    }];
    const used = tutorialConceptsUsed(state, false);
    expect([...used]).toEqual(expect.arrayContaining(['movement', 'route-confirmation', 'tackle-zones', 'dodging', 'cumulative-probability']));
  });

  it('uses plain progress labels', () => {
    expect(tutorialConceptStatusLabel(undefined)).toBe('Not encountered');
    expect(tutorialConceptStatusLabel('introduced')).toBe('Introduced');
    expect(tutorialConceptStatusLabel('used')).toBe('Used');
  });
});
