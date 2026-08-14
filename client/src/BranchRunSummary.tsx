import { useId } from 'react';
import type { BranchStripEntry } from './branchRun';
import type { BranchSummary } from './blockBranchTree';
import { useModalFocus } from './useModalFocus';
import './SubmitModal.css'; // shared modal-backdrop/modal styles
import './BranchRunSummary.css';

interface Props {
  scenarioName: string;
  summary: BranchSummary;
  branches: BranchStripEntry[];
  onDismiss: () => void;
}

function pct(value: number): string {
  if (value > 0 && value < 0.005) return '<1%';
  return `${Math.round(value * 100)}%`;
}

/**
 * End-of-run readout for the branching model.
 *
 * Deliberately not a leaderboard submission. A policy score is a sum over the
 * branches that reach a touchdown, while the server still validates a score as
 * the *product* of a single line's rolls — so a run authored here cannot be
 * submitted without the branch-tree format that comes with the scoring phase.
 * Showing the number and saying why it stops here beats posting one the server
 * would reject, or worse, silently mis-scoring the board.
 */
export function BranchRunSummary({ scenarioName, summary, branches, onDismiss }: Props) {
  const titleId = useId();
  const ref = useModalFocus<HTMLDivElement>(onDismiss);

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

        <p className="branch-summary__note">
          Branching runs aren't on the leaderboard yet — the score is a total across
          outcomes, which the submission format doesn't carry.
        </p>

        <div className="submit-modal__actions">
          <button className="modal__continue-btn" onClick={onDismiss}>Done</button>
        </div>
      </div>
    </div>
  );
}
