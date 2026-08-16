import { useState } from 'react';
import { ActionLogDetail } from './ActionLogDetail';
import { BallIcon } from './BallIcon';
import type { ActionLogEntry, Scenario } from './types';
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

  // onSubmit may be async (it hits the network). Track it so the button can't
  // be double-fired, and clear the flag when a failure comes back so the
  // player can retry.
  const runSubmit = (value: string) => {
    setSubmitting(true);
    void Promise.resolve(onSubmit(value)).finally(() => setSubmitting(false));
  };

  return (
    <div className="modal-backdrop">
      <div className="modal submit-modal">
        <div className="submit-modal__td">
          <BallIcon className="submit-modal__td-ball" />
          TOUCHDOWN!
        </div>

        <ActionLogDetail scenario={scenario} actionLog={actionLog} />

        {error && (
          <p className="submit-modal__error" role="alert">{error}</p>
        )}

        {seriesMode ? (
          <div className="submit-modal__actions">
            <button className="modal__roll-btn" disabled={submitting} onClick={() => runSubmit('')}>
              {submitting ? 'Saving...' : error ? 'Try Again' : continueLabel ?? 'Continue'}
            </button>
            {onReviewBoard && (
              <button className="modal__continue-btn" disabled={submitting} onClick={onReviewBoard}>
                Review Board
              </button>
            )}
          </div>
        ) : (
          <>
            {signedInName ? (
              <p className="submit-modal__prompt">Submit as {signedInName}</p>
            ) : (
              <>
                <p className="submit-modal__prompt">Enter a public alias for the leaderboard:</p>
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
              </>
            )}
            <div className="submit-modal__actions">
              <button
                className="modal__roll-btn"
                disabled={!name.trim() || submitting}
                onClick={() => runSubmit(name.trim())}
              >
                {submitting ? 'Saving...' : error ? 'Try Again' : 'Submit Score'}
              </button>
              <button className="modal__continue-btn" disabled={submitting} onClick={onDismiss}>
                Skip
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
