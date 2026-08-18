import { useId, useState } from 'react';
import parallelUniversesArtwork from './assets/parallel-universes-decision-tree.webp';
import type { TutorialLesson } from './tutorialLessons';
import { useModalFocus } from './useModalFocus';
import './SubmitModal.css';
import './TutorialLessonDialog.css';

interface Props {
  lesson: TutorialLesson;
  step: number;
  total: number;
  onDismiss: (disableFutureLessons: boolean) => void;
  onReturnToMenu: () => void;
}

const ARTWORK = {
  'parallel-universes': {
    src: parallelUniversesArtwork,
    alt: 'A pointed iron decision tree splitting one block into six parallel board states',
  },
} as const;

export function TutorialLessonDialog({ lesson, step, total, onDismiss, onReturnToMenu }: Props) {
  const titleId = useId();
  const [disableFutureLessons, setDisableFutureLessons] = useState(false);
  const ref = useModalFocus<HTMLDivElement>(() => onDismiss(false));
  const artwork = lesson.artwork ? ARTWORK[lesson.artwork] : undefined;

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
        {artwork && (
          <img
            className="tutorial-lesson__artwork"
            src={artwork.src}
            alt={artwork.alt}
          />
        )}
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
            className="modal__continue-btn"
            onClick={onReturnToMenu}
          >
            Return to Menu
          </button>
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
