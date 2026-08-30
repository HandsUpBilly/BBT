import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tutorialLessonFor } from './tutorialLessons';
import { TutorialObjectiveCard } from './TutorialObjectiveCard';

afterEach(cleanup);

describe('TutorialObjectiveCard', () => {
  it('orients without requiring a Begin Puzzle action', () => {
    const onDismiss = vi.fn();
    render(<TutorialObjectiveCard lesson={tutorialLessonFor('scenario-001')!} objective="Reach the End Zone." onDismiss={onDismiss} />);
    expect(screen.getByText('Reach the End Zone.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /begin/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss drill objective' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
