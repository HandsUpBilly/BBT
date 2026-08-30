import { useState } from 'react';
import type { GameState } from './types';
import {
  tutorialConceptStatusLabel,
  type TutorialConcept,
  type TutorialConceptId,
  type TutorialConceptProgress,
} from './tutorialConcepts';
import { TutorialMiniDiagram } from './TutorialMiniDiagram';
import { useModalFocus } from './useModalFocus';
import './SubmitModal.css';
import './TutorialConceptGuideDialog.css';

interface Props {
  drillTitle: string;
  concepts: readonly TutorialConcept[];
  progress: TutorialConceptProgress;
  state: GameState;
  onIntroduce: (conceptId: TutorialConceptId) => void;
  onClose: () => void;
}

export function TutorialConceptGuideDialog({
  drillTitle, concepts, progress, state, onIntroduce, onClose,
}: Props) {
  const ref = useModalFocus<HTMLDivElement>(onClose);
  const [selectedId, setSelectedId] = useState<TutorialConceptId>();
  const [showSuggestion, setShowSuggestion] = useState(false);
  const selected = concepts.find(concept => concept.id === selectedId);

  const choose = (concept: TutorialConcept) => {
    setSelectedId(concept.id);
    setShowSuggestion(false);
    onIntroduce(concept.id);
  };

  return (
    <div className="modal-backdrop">
      <section ref={ref} className="modal tutorial-concept-guide" role="dialog" aria-modal="true" aria-labelledby="tutorial-concept-guide-title" tabIndex={-1}>
        <p className="tutorial-concept-guide__eyebrow">Tutorial guide</p>
        <h2 id="tutorial-concept-guide-title" className="modal__title">{drillTitle}</h2>
        {!selected ? (
          <>
            <p className="tutorial-concept-guide__intro">Choose a concept. Progress is kept for this player across Tutorial drills.</p>
            <ul className="tutorial-concept-guide__list">
              {concepts.map(concept => (
                <li key={concept.id}>
                  <button type="button" onClick={() => choose(concept)}>
                    <strong>{concept.title}</strong>
                    <span className={`tutorial-concept-guide__status tutorial-concept-guide__status--${progress[concept.id] ?? 'new'}`}>
                      {tutorialConceptStatusLabel(progress[concept.id])}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="tutorial-concept-guide__detail">
            <button type="button" className="tutorial-concept-guide__back" onClick={() => setSelectedId(undefined)}>← All concepts</button>
            <h3>{selected.title}</h3>
            <TutorialMiniDiagram state={state} hint={selected.hint} />
            <p>{selected.explanation}</p>
            {showSuggestion && <p className="tutorial-concept-guide__suggestion"><strong>What next:</strong> {selected.suggestion}</p>}
            {!showSuggestion && (
              <button type="button" className="modal__continue-btn" onClick={() => setShowSuggestion(true)}>Suggest what to consider next</button>
            )}
          </div>
        )}
        <div className="tutorial-concept-guide__actions">
          <button type="button" className="modal__roll-btn" onClick={onClose}>Close</button>
        </div>
      </section>
    </div>
  );
}
