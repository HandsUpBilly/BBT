import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { scenarios } from './scenarios';
import { makeScenarioState } from './useGameState';
import { tutorialConceptsForScenario } from './tutorialConcepts';
import { TutorialConceptGuideDialog } from './TutorialConceptGuideDialog';

afterEach(cleanup);

describe('TutorialConceptGuideDialog', () => {
  it('opens as a progress list and never offers an exact hint', () => {
    const state = makeScenarioState(scenarios.find(scenario => scenario.id === 'scenario-003')!);
    const onIntroduce = vi.fn();
    render(
      <TutorialConceptGuideDialog
        drillTitle="Passing"
        concepts={tutorialConceptsForScenario('scenario-003')}
        progress={{ passing: 'introduced', 'route-confirmation': 'used' }}
        state={state}
        onIntroduce={onIntroduce}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Introduced')).toBeTruthy();
    expect(screen.getByText('Used')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /PassingIntroduced/i }));
    expect(onIntroduce).toHaveBeenCalledWith('passing');
    expect(screen.getByRole('button', { name: 'Suggest what to consider next' })).toBeTruthy();
    expect(screen.queryByText(/exact hint/i)).toBeNull();
  });
});
