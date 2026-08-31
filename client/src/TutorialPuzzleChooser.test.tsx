import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { scenarios } from './scenarios';
import { TutorialPuzzleChooser } from './TutorialPuzzleChooser';

afterEach(cleanup);

describe('TutorialPuzzleChooser', () => {
  const tutorialScenarios = scenarios.slice(0, 3);

  it('offers unfinished and completed drills and reports run progress', () => {
    const onChoose = vi.fn();
    const onLeaderboard = vi.fn();
    render(
      <TutorialPuzzleChooser
        seriesName="Tutorial"
        scenarios={tutorialScenarios}
        completedScenarioIds={new Set([tutorialScenarios[0].id])}
        onChoose={onChoose}
        onLeaderboard={onLeaderboard}
        onLeave={vi.fn()}
      />,
    );

    expect(screen.getByText('1 complete · 2 remaining')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Play this drill' })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Replay this drill' }));
    expect(onChoose).toHaveBeenCalledWith(tutorialScenarios[0]);
    fireEvent.click(screen.getByRole('button', { name: `Rankings for ${tutorialScenarios[1].name}` }));
    expect(onLeaderboard).toHaveBeenCalledWith(tutorialScenarios[1]);
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
        onLeaderboard={vi.fn()}
        onLeave={onLeave}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Play this drill' })[1]);
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
        onLeaderboard={vi.fn()}
        onLeave={vi.fn()}
      />,
    );
    expect(screen.getByText('Moved Sera 4 squares')).toBeTruthy();
    expect(screen.getByText('Final probability 72%')).toBeTruthy();
  });
});
