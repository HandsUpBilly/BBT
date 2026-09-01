import { useId } from 'react';
import driveFailedLockup from './assets/drive-failed-lockup.webp';
import parallelUniversesArt from './assets/parallel-universes-decision-tree.webp';
import { useModalFocus } from './useModalFocus';
import './RunOutcomeDialog.css';

type Props = {
  variant: 'failed';
  onRestart: () => void;
  onExit: () => void;
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
              The ball carrier has finished their activation without reaching the end zone.
              They cannot act again this turn, so the puzzle can no longer be completed.
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
