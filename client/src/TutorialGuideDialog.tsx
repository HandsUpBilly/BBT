import { useId } from 'react';
import type { GameState } from './types';
import type { TutorialGuideDefinition } from './tutorialGuides';
import type { TutorialGuideProgress } from './tutorialGuideProgress';
import { TutorialMiniDiagram } from './TutorialMiniDiagram';
import { useModalFocus } from './useModalFocus';
import './SubmitModal.css';
import './TutorialGuideDialog.css';

interface Props {
  drillTitle: string;
  guide: TutorialGuideDefinition;
  progress: TutorialGuideProgress;
  state: GameState;
  onDismiss: () => void;
  onMoreHelp: () => void;
  onSkip: () => void;
}

export function TutorialGuideDialog({
  drillTitle, guide, progress, state, onDismiss, onMoreHelp, onSkip,
}: Props) {
  const titleId = useId();
  const ref = useModalFocus<HTMLDivElement>(onDismiss);
  const stage = guide.stages[progress.stageIndex];
  if (!stage) return null;
  const hint = stage.hints[progress.tier];

  return (
    <div className="modal-backdrop">
      <div
        ref={ref}
        className="modal tutorial-guide"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <p className="tutorial-guide__progress">
          {drillTitle}: Step {progress.stageIndex + 1} of {guide.stages.length}
        </p>
        <h2 id={titleId} className="modal__title">{stage.title}</h2>
        <p className="tutorial-guide__tier" aria-live="polite">
          {progress.tier === 0 ? 'Coach prompt' : progress.tier === 1 ? 'Directed hint' : 'Exact hint'}
        </p>
        <TutorialMiniDiagram state={state} hint={hint} />
        <p className="tutorial-guide__copy">{hint.text}</p>
        {progress.lastContradictionKey && (
          <p className="tutorial-guide__recovery"><strong>Try this:</strong> {stage.recovery}</p>
        )}
        <div className="tutorial-guide__actions">
          <button type="button" className="tutorial-guide__skip" onClick={onSkip}>Skip guide</button>
          {progress.tier < 2 && (
            <button type="button" className="modal__continue-btn" onClick={onMoreHelp}>More help</button>
          )}
          <button type="button" className="modal__roll-btn" onClick={onDismiss}>Try it</button>
        </div>
      </div>
    </div>
  );
}
