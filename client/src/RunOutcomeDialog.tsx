import { useId } from 'react';
import driveFailedLockup from './assets/drive-failed-lockup.webp';
import parallelUniversesArt from './assets/parallel-universes-decision-tree.webp';
import { useModalFocus } from './useModalFocus';
import './RunOutcomeDialog.css';

type Props = {
  variant: 'failed';
  onRestart: () => void;
  onExit: () => void;
  objective?: 'touchdown' | 'crowd-surf';
} | {
  variant: 'failed-branch';
  remainingBranches: number;
  onConcede: () => void;
} | {
  variant: 'unfinished-branches';
  remainingBranches: number;
  onContinue: () => void;
};

export function RunOutcomeDialog(props: Props) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useModalFocus<HTMLDivElement>();

  if (props.variant === 'failed') {
    return (
      <div className="modal-backdrop run-outcome-backdrop">
        <section
          ref={dialogRef}
          className="modal run-outcome-dialog run-outcome-dialog--failed"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          tabIndex={-1}
        >
          <header className="run-outcome-dialog__banner">
            <h2 id={titleId} className="submit-modal__visually-hidden">Drive failed</h2>
            <img src={driveFailedLockup} alt="" decoding="async" />
          </header>
          <div className="run-outcome-dialog__body">
            <p id={descriptionId}>
              {props.objective === 'crowd-surf'
                ? 'No legal block or blitz remains that can send an opposing player into the crowd this turn.'
                : 'The ball carrier has finished their activation without reaching the end zone. They cannot act again this turn, so the puzzle can no longer be completed.'}
            </p>
            <div className="submit-modal__actions run-outcome-dialog__actions">
              <button type="button" className="modal__roll-btn" onClick={props.onRestart}>
                Restart Puzzle
              </button>
              <button type="button" className="modal__continue-btn" onClick={props.onExit}>
                Exit Puzzle
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (props.variant === 'failed-branch') {
    return (
      <div className="modal-backdrop run-outcome-backdrop">
        <section
          ref={dialogRef}
          className="modal run-outcome-dialog run-outcome-dialog--branches"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          tabIndex={-1}
        >
          <div className="run-outcome-dialog__branch-art" aria-hidden="true">
            <img src={parallelUniversesArt} alt="" decoding="async" />
          </div>
          <div className="run-outcome-dialog__body">
            <span className="run-outcome-dialog__kicker">One universe has stalled</span>
            <h2 id={titleId}>This outcome cannot complete the objective</h2>
            <p id={descriptionId}>
              Give up this universe only. Its chance contributes zero to your score,
              but successful outcomes in other universes still count.
              {props.remainingBranches > 0
                ? ` ${props.remainingBranches} other unresolved ${props.remainingBranches === 1 ? 'universe remains' : 'universes remain'}.`
                : ' You can then review the completed run.'}
            </p>
            <div className="submit-modal__actions run-outcome-dialog__actions">
              <button type="button" className="modal__roll-btn" onClick={props.onConcede}>
                Give Up This Universe
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const branchLabel = props.remainingBranches === 1 ? 'universe remains' : 'universes remain';
  return (
    <div className="modal-backdrop run-outcome-backdrop">
      <section
        ref={dialogRef}
        className="modal run-outcome-dialog run-outcome-dialog--branches"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <div className="run-outcome-dialog__branch-art" aria-hidden="true">
          <img src={parallelUniversesArt} alt="" decoding="async" />
        </div>
        <div className="run-outcome-dialog__body">
          <span className="run-outcome-dialog__kicker">One universe secured</span>
          <h2 id={titleId}>Touchdown, but the run is not finished</h2>
          <p id={descriptionId}>
            This branch scored. {props.remainingBranches} {branchLabel} unresolved,
            and each still contributes to your final scoring chance.
          </p>
          <div className="submit-modal__actions run-outcome-dialog__actions">
            <button type="button" className="modal__roll-btn" onClick={props.onContinue}>
              Continue Remaining Branches
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
