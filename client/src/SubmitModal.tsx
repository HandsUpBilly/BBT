import { useId, useState } from 'react';
import { ActionLogDetail } from './ActionLogDetail';
import touchdownLockup from './assets/touchdown-lockup.webp';
import type { ActionLogEntry, Scenario } from './types';
import { useModalFocus } from './useModalFocus';
import './SubmitModal.css';

interface Props {
  scenario: Scenario;
  actionLog: ActionLogEntry[];
  onSubmit: (name: string) => void;
  onDismiss: () => void;
  /**
   * Series mode: hides the name input and Skip button, and shows a single
   * "Continue" action (the name was already captured at series start).
   */
  seriesMode?: boolean;
  continueLabel?: string;
  /** Temporarily reveal the completed pitch without advancing the series. */
  onReviewBoard?: () => void;
  defaultName?: string;
  signedInName?: string;
  /** Submission failure — keeps the dialog open so the player can retry. */
  error?: string;
}

export function SubmitModal({ scenario, actionLog, onSubmit, onDismiss, seriesMode, continueLabel, onReviewBoard, defaultName = '', signedInName, error }: Props) {
  const [name, setName] = useState(defaultName);
  const [submitting, setSubmitting] = useState(false);
  const titleId = useId();
  // A scored run needs an explicit Submit, Continue or Skip choice, so Escape
  // does not dismiss it. The hook still traps focus and restores the launcher.
  const dialogRef = useModalFocus<HTMLDivElement>();

  // onSubmit may be async (it hits the network). Track it so the button can't
  // be double-fired, and clear the flag when a failure comes back so the
  // player can retry.
  const runSubmit = (value: string) => {
    setSubmitting(true);
    void Promise.resolve(onSubmit(value)).finally(() => setSubmitting(false));
  };

  return (
    <div className="modal-backdrop">
      <div
        ref={dialogRef}
        className="modal submit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="submit-modal__masthead">
          <h2 id={titleId} className="submit-modal__visually-hidden">Touchdown!</h2>
          <img
            className="submit-modal__masthead-art"
            src={touchdownLockup}
            alt=""
            decoding="async"
          />
        </header>

        <div className="submit-modal__content">
          <ActionLogDetail scenario={scenario} actionLog={actionLog} variant="review" />

          {error && (
            <p className="submit-modal__error" role="alert">{error}</p>
          )}

          {seriesMode ? (
            <footer className="submit-modal__footer submit-modal__footer--actions-only">
              <div className="submit-modal__actions">
                {onReviewBoard && (
                  <button className="modal__continue-btn" disabled={submitting} onClick={onReviewBoard}>
                    Review Board
                  </button>
                )}
                <button className="modal__roll-btn" disabled={submitting} onClick={() => runSubmit('')}>
                  {submitting ? 'Saving...' : error ? 'Try Again' : continueLabel ?? 'Continue'}
                </button>
              </div>
            </footer>
          ) : (
            <footer className="submit-modal__footer">
              <div className="submit-modal__identity">
                {signedInName ? (
                  <p className="submit-modal__prompt">Submit as <strong>{signedInName}</strong></p>
                ) : (
                  <label className="submit-modal__alias-field">
                    <span>Leaderboard alias</span>
                    <input
                      className="submit-modal__input"
                      type="text"
                      maxLength={32}
                      placeholder="Your public alias"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && name.trim() && !submitting && runSubmit(name.trim())}
                      autoFocus
                    />
                  </label>
                )}
              </div>
              <div className="submit-modal__actions">
                <button className="modal__continue-btn" disabled={submitting} onClick={onDismiss}>
                  Skip
                </button>
                <button
                  className="modal__roll-btn"
                  disabled={!name.trim() || submitting}
                  onClick={() => runSubmit(name.trim())}
                >
                  {submitting ? 'Saving...' : error ? 'Try Again' : 'Submit Score'}
                </button>
              </div>
            </footer>
          )}
        </div>
      </div>
    </div>
  );
}
