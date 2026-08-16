import { useId, useState } from 'react';
import type { TutorialLesson } from './tutorialLessons';
import { useModalFocus } from './useModalFocus';
import './SubmitModal.css';
import './TutorialLessonDialog.css';

interface Props {
  lesson: TutorialLesson;
  step: number;
  total: number;
  onDismiss: (disableFutureLessons: boolean) => void;
}

export function TutorialLessonDialog({ lesson, step, total, onDismiss }: Props) {
  const titleId = useId();
  const [disableFutureLessons, setDisableFutureLessons] = useState(false);
  const ref = useModalFocus<HTMLDivElement>(() => onDismiss(false));

  return (
    <div className="modal-backdrop">
      <div
        ref={ref}
        className="modal tutorial-lesson"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <p className="tutorial-lesson__progress">Tutorial Drill {step} / {total}</p>
        <h2 id={titleId} className="modal__title">{lesson.title}</h2>
        <div className="tutorial-lesson__copy">
          {lesson.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
        </div>
        <label className="tutorial-lesson__opt-out">
          <input
            type="checkbox"
            checked={disableFutureLessons}
            onChange={event => setDisableFutureLessons(event.target.checked)}
          />
          <span>Do not show these rules briefings again</span>
        </label>
        <div className="submit-modal__actions">
          <button
            type="button"
            className="modal__roll-btn"
            onClick={() => onDismiss(disableFutureLessons)}
          >
            Begin Puzzle
          </button>
        </div>
      </div>
    </div>
  );
}
