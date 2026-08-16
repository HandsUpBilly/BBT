import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SubmitModal } from './SubmitModal';
import type { Scenario } from './types';

const scenario: Scenario = {
  id: 'scenario-002',
  name: 'The Reikland Hand-off',
  description: 'Score with a handoff.',
  activeTeam: 'human',
  pieces: [{
    id: 'runner', team: 'human', role: 'catcher', name: 'Runner',
    ma: 7, st: 3, ag: 3, pa: 4, av: 8, skills: [],
    position: { col: 7, row: 6 }, hasBall: true,
  }],
};

afterEach(cleanup);

describe('SubmitModal series board review', () => {
  it('offers board review without submitting or dismissing the result', () => {
    const onSubmit = vi.fn();
    const onDismiss = vi.fn();
    const onReviewBoard = vi.fn();

    render(
      <SubmitModal
        scenario={scenario}
        actionLog={[]}
        onSubmit={onSubmit}
        onDismiss={onDismiss}
        onReviewBoard={onReviewBoard}
        seriesMode
        continueLabel="Continue to Puzzle 3"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Review Board' }));

    expect(onReviewBoard).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
