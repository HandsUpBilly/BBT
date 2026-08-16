import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TutorialLessonDialog } from './TutorialLessonDialog';
import { TUTORIAL_LESSONS } from './tutorialLessons';

afterEach(cleanup);

describe('TutorialLessonDialog', () => {
  it('shows progress and dismisses the lesson', () => {
    const onDismiss = vi.fn();
    render(<TutorialLessonDialog lesson={TUTORIAL_LESSONS[0]} step={1} total={6} onDismiss={onDismiss} />);

    expect(screen.getByText('Tutorial 1 of 6')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Move and score' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Start puzzle' }));
    expect(onDismiss).toHaveBeenCalledWith(false);
  });

  it('can disable all future lessons', () => {
    const onDismiss = vi.fn();
    render(<TutorialLessonDialog lesson={TUTORIAL_LESSONS[5]} step={6} total={6} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('checkbox', { name: /Don't show tutorial lessons again/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start puzzle' }));
    expect(onDismiss).toHaveBeenCalledWith(true);
  });

  it('treats Escape as a normal one-lesson dismissal', () => {
    const onDismiss = vi.fn();
    render(<TutorialLessonDialog lesson={TUTORIAL_LESSONS[0]} step={1} total={6} onDismiss={onDismiss} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledWith(false);
  });
});
