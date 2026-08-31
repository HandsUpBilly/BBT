import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { scenarios } from './scenarios';
import { TutorialPuzzleChooser } from './TutorialPuzzleChooser';

afterEach(cleanup);

describe('TutorialPuzzleChooser', () => {
  const tutorialScenarios = scenarios.slice(0, 3);

  it('offers unfinished and completed drills and reports run progress', () => {
    const onChoose = vi.fn();
    render(
      <TutorialPuzzleChooser
        seriesName="Tutorial"
        scenarios={tutorialScenarios}
        completedScenarioIds={new Set([tutorialScenarios[0].id])}
        onChoose={onChoose}
        onLeave={vi.fn()}
      />,
    );

    expect(screen.getByText('1 complete · 2 remaining')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Play' })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Replay' }));
    expect(onChoose).toHaveBeenCalledWith(tutorialScenarios[0]);
  });

  it('returns the selected scenario and can leave the run', () => {
    const onChoose = vi.fn();
    const onLeave = vi.fn();
    render(
      <TutorialPuzzleChooser
        seriesName="Tutorial"
        scenarios={tutorialScenarios}
        completedScenarioIds={new Set()}
        onChoose={onChoose}
        onLeave={onLeave}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Play' })[1]);
    fireEvent.click(screen.getByRole('button', { name: '← Main menu' }));

    expect(onChoose).toHaveBeenCalledWith(tutorialScenarios[1]);
    expect(onLeave).toHaveBeenCalledOnce();
  });

  it('shows a neutral recap for a completed drill', () => {
    const scenario = tutorialScenarios[0];
    render(
      <TutorialPuzzleChooser
        seriesName="Tutorial"
        scenarios={[scenario]}
        completedScenarioIds={new Set([scenario.id])}
        recaps={{ [scenario.id]: { actions: ['Moved Sera 4 squares'], probability: 0.72 } }}
        onChoose={vi.fn()}
        onLeave={vi.fn()}
      />,
    );
    expect(screen.getByText('Moved Sera 4 squares')).toBeTruthy();
    expect(screen.getByText('Final probability 72%')).toBeTruthy();
  });
});
