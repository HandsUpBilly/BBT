import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { scenarios } from './scenarios';
import { makeScenarioState } from './useGameState';
import { tutorialGuideFor } from './tutorialGuides';
import { startTutorialGuide } from './tutorialGuideProgress';
import { TutorialGuideDialog } from './TutorialGuideDialog';

afterEach(cleanup);

describe('TutorialGuideDialog', () => {
  const guide = tutorialGuideFor('scenario-001')!;
  const gameState = makeScenarioState(scenarios.find(item => item.id === 'scenario-001')!);

  it('shows stage progress, a mini diagram, and all first-tier controls', () => {
    render(
      <TutorialGuideDialog
        drillTitle="Movement"
        guide={guide}
        progress={startTutorialGuide(guide)}
        state={gameState}
        onDismiss={vi.fn()}
        onMoreHelp={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    expect(screen.getByText('Movement: Step 1 of 4')).toBeTruthy();
    expect(screen.getByRole('img', { name: /opening formation with the ball carrier/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'More help' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Skip guide' })).toBeTruthy();
  });

  it('runs Try it, More help, Skip guide, and Escape independently', () => {
    const onDismiss = vi.fn();
    const onMoreHelp = vi.fn();
    const onSkip = vi.fn();
    render(
      <TutorialGuideDialog
        drillTitle="Movement"
        guide={guide}
        progress={startTutorialGuide(guide)}
        state={gameState}
        onDismiss={onDismiss}
        onMoreHelp={onMoreHelp}
        onSkip={onSkip}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More help' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip guide' }));
    fireEvent.click(screen.getByRole('button', { name: 'Try it' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onMoreHelp).toHaveBeenCalledOnce();
    expect(onSkip).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });
});
