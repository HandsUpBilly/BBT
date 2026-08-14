import { useId, useState } from 'react';
import type { BranchStripEntry } from './branchRun';
import type { BranchSummary } from './blockBranchTree';
import { useModalFocus } from './useModalFocus';
import './SubmitModal.css'; // shared modal-backdrop/modal styles
import './BranchRunSummary.css';

interface Props {
  scenarioName: string;
  summary: BranchSummary;
  branches: BranchStripEntry[];
  onSubmit: (name: string) => void;
  onDismiss: () => void;
  defaultName?: string;
  signedInName?: string;
  /** Submission failure — keeps the dialog open so the player can retry. */
  error?: string;
}

function pct(value: number): string {
  if (value > 0 && value < 0.005) return '<1%';
  return `${Math.round(value * 100)}%`;
}

/**
 * End-of-run readout for the branching model, and its submission step.
 *
 * The breakdown is the point: a single percentage hides which branch cost what,
 * and that is exactly the thing the player is here to learn. The submission
 * carries the branch tree alongside the score so the server can recompute it —
 * a policy score is a sum over the branches that reach a touchdown, not the
 * product of one line's rolls.
 */
export function BranchRunSummary({
  scenarioName, summary, branches, onSubmit, onDismiss, defaultName, signedInName, error,
}: Props) {
  const titleId = useId();
  const ref = useModalFocus<HTMLDivElement>(onDismiss);
  const [name, setName] = useState(defaultName ?? '');
  const [submitting, setSubmitting] = useState(false);

  function runSubmit(value: string) {
    setSubmitting(true);
    onSubmit(value);
    // The parent keeps the dialog open on failure and swaps in `error`, so
    // clear the busy state rather than leaving the button stuck on "Saving…".
    setSubmitting(false);
  }

  const submitName = signedInName || name.trim();

  const scored = branches.filter(b => b.status === 'scored');
  const givenUp = branches.filter(b => b.status === 'conceded');

  return (
    <div className="modal-backdrop">
      <div
        ref={ref}
        className="modal branch-summary"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <h2 id={titleId} className="modal__title">{scenarioName} — run complete</h2>

        <p className="branch-summary__score">
          <strong>{pct(summary.score)}</strong>
          <span>chance this plan scores</span>
        </p>

        <dl className="branch-summary__breakdown">
          <div>
            <dt>Scored in</dt>
            <dd>{scored.length} of {branches.length} branches</dd>
          </div>
          <div>
            <dt>Lost to knockdowns</dt>
            <dd>{pct(summary.deadWeight)}</dd>
          </div>
          <div>
            <dt>Lost to failed rolls</dt>
            <dd>{pct(summary.failedRollWeight)}</dd>
          </div>
          {givenUp.length > 0 && (
            <div>
              <dt>Given up on</dt>
              <dd>{pct(summary.unresolvedWeight)}</dd>
            </div>
          )}
          {/*
            * Expected dice is averaged over the lines that actually score, so
            * a run that scores nowhere has nothing to average and would report
            * a flat 0.0 — which reads as a bug rather than as "not applicable".
            */}
          {summary.score > 0 && (
            <div>
              <dt>Block dice rolled</dt>
              <dd>{summary.expectedDice.toFixed(1)} on average</dd>
            </div>
          )}
        </dl>

        <ul className="branch-summary__branches">
          {branches.map(branch => (
            <li key={branch.id} className={`branch-summary__branch branch-summary__branch--${branch.status}`}>
              <span>{branch.label}</span>
              <span className="branch-summary__branch-weight">{pct(branch.weight)}</span>
              <span className="branch-summary__branch-value">
                {branch.status === 'conceded' ? 'given up' : `scores ${pct(branch.value)}`}
              </span>
            </li>
          ))}
        </ul>

        {error && <p className="submit-modal__error" role="alert">{error}</p>}

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
              onKeyDown={e => e.key === 'Enter' && submitName && !submitting && runSubmit(submitName)}
              autoFocus
            />
          </>
        )}

        <div className="submit-modal__actions">
          <button
            className="modal__roll-btn"
            disabled={!submitName || submitting || summary.score <= 0}
            title={summary.score <= 0 ? 'A run that scores nowhere has nothing to submit' : undefined}
            onClick={() => runSubmit(submitName)}
          >
            {submitting ? 'Saving…' : error ? 'Try Again' : 'Submit Score'}
          </button>
          <button className="modal__continue-btn" disabled={submitting} onClick={onDismiss}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
