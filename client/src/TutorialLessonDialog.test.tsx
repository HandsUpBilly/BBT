import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TutorialLessonDialog } from './TutorialLessonDialog';
import { TUTORIAL_LESSONS } from './tutorialLessons';

afterEach(cleanup);

describe('TutorialLessonDialog', () => {
  it('shows progress and dismisses the lesson', () => {
    const onDismiss = vi.fn();
    render(
      <TutorialLessonDialog
        lesson={TUTORIAL_LESSONS[0]}
        step={1}
        total={TUTORIAL_LESSONS.length}
        onDismiss={onDismiss}
        onReturnToMenu={vi.fn()}
      />,
    );

    expect(screen.getByText(`Tutorial Drill 1 / ${TUTORIAL_LESSONS.length}`)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Movement' })).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Begin Puzzle' }));
    expect(onDismiss).toHaveBeenCalledWith(false);
  });

  it('can disable all future lessons', () => {
    const onDismiss = vi.fn();
    const finalLesson = TUTORIAL_LESSONS.at(-1)!;
    render(
      <TutorialLessonDialog
        lesson={finalLesson}
        step={TUTORIAL_LESSONS.length}
        total={TUTORIAL_LESSONS.length}
        onDismiss={onDismiss}
        onReturnToMenu={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: finalLesson.title })).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: /Do not show these rules briefings again/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Begin Puzzle' }));
    expect(onDismiss).toHaveBeenCalledWith(true);
  });

  it('treats Escape as a normal one-lesson dismissal', () => {
    const onDismiss = vi.fn();
    render(
      <TutorialLessonDialog
        lesson={TUTORIAL_LESSONS[0]}
        step={1}
        total={TUTORIAL_LESSONS.length}
        onDismiss={onDismiss}
        onReturnToMenu={vi.fn()}
      />,
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledWith(false);
  });

  it('offers a return to the main menu', () => {
    const onReturnToMenu = vi.fn();
    render(
      <TutorialLessonDialog
        lesson={TUTORIAL_LESSONS[0]}
        step={1}
        total={TUTORIAL_LESSONS.length}
        onDismiss={vi.fn()}
        onReturnToMenu={onReturnToMenu}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Return to Menu' }));
    expect(onReturnToMenu).toHaveBeenCalledOnce();
  });
});
