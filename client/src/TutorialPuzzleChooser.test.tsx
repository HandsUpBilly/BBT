import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { scenarios } from './scenarios';
import { TutorialPuzzleChooser } from './TutorialPuzzleChooser';

afterEach(cleanup);

describe('TutorialPuzzleChooser', () => {
  const tutorialScenarios = scenarios.slice(0, 3);

  it('offers every unfinished drill and reports run progress', () => {
    render(
      <TutorialPuzzleChooser
        seriesName="Tutorial"
        scenarios={tutorialScenarios}
        completedScenarioIds={new Set([tutorialScenarios[0].id])}
        onChoose={vi.fn()}
        onLeave={vi.fn()}
      />,
    );

    expect(screen.getByText('1 complete · 2 remaining')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Play this drill' })).toHaveLength(2);
    expect((screen.getByRole('button', { name: 'Completed' }) as HTMLButtonElement).disabled).toBe(true);
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

    fireEvent.click(screen.getAllByRole('button', { name: 'Play this drill' })[1]);
    fireEvent.click(screen.getByRole('button', { name: '← Main menu' }));

    expect(onChoose).toHaveBeenCalledWith(tutorialScenarios[1]);
    expect(onLeave).toHaveBeenCalledOnce();
  });
});
