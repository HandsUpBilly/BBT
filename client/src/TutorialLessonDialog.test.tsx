import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TutorialLessonDialog } from './TutorialLessonDialog';
import { TUTORIAL_LESSONS } from './tutorialLessons';

afterEach(cleanup);

describe('TutorialLessonDialog', () => {
  it('shows progress and dismisses the lesson', () => {
    const onDismiss = vi.fn();
    render(<TutorialLessonDialog lesson={TUTORIAL_LESSONS[0]} step={1} total={6} onDismiss={onDismiss} />);

    expect(screen.getByText('Tutorial Drill 1 / 6')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Movement' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Begin Puzzle' }));
    expect(onDismiss).toHaveBeenCalledWith(false);
  });

  it('can disable all future lessons', () => {
    const onDismiss = vi.fn();
    render(<TutorialLessonDialog lesson={TUTORIAL_LESSONS[5]} step={6} total={6} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('checkbox', { name: /Do not show these rules briefings again/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Begin Puzzle' }));
    expect(onDismiss).toHaveBeenCalledWith(true);
  });

  it('treats Escape as a normal one-lesson dismissal', () => {
    const onDismiss = vi.fn();
    render(<TutorialLessonDialog lesson={TUTORIAL_LESSONS[0]} step={1} total={6} onDismiss={onDismiss} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledWith(false);
  });
});
