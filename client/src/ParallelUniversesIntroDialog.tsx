import type { GameState } from './types';
import type { TutorialConcept } from './tutorialConcepts';
import { TutorialMiniDiagram } from './TutorialMiniDiagram';
import { useModalFocus } from './useModalFocus';
import './SubmitModal.css';
import './TutorialGuideDialog.css';

interface Props {
  concept: TutorialConcept;
  state: GameState;
  onContinue: () => void;
}

export function ParallelUniversesIntroDialog({ concept, state, onContinue }: Props) {
  const ref = useModalFocus<HTMLDivElement>(onContinue);
  return (
    <div className="modal-backdrop">
      <section ref={ref} className="modal tutorial-guide" role="dialog" aria-modal="true" aria-labelledby="parallel-universes-intro-title" tabIndex={-1}>
        <p className="tutorial-guide__progress">New major concept</p>
        <h2 id="parallel-universes-intro-title" className="modal__title">{concept.title}</h2>
        <TutorialMiniDiagram state={state} hint={concept.hint} />
        <p className="tutorial-guide__copy">{concept.explanation}</p>
        <p className="tutorial-guide__copy"><strong>What next:</strong> {concept.suggestion}</p>
        <div className="tutorial-guide__actions">
          <button type="button" className="modal__roll-btn" onClick={onContinue}>Continue</button>
        </div>
      </section>
    </div>
  );
}
