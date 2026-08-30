import { useId, useState } from 'react';
import { branchTreeView, type BranchRun, type BranchStripEntry } from './branchRun';
import type { BranchSummary } from './blockBranchTree';
import type { Scenario } from './types';
import { useModalFocus } from './useModalFocus';
import { ActionLogDetail } from './ActionLogDetail';
import { BranchReviewGraphic } from './BranchReviewGraphic';
import { BranchTreeGraphic } from './BranchTreeGraphic';
import './SubmitModal.css'; // shared modal-backdrop/modal styles
import './BranchRunSummary.css';

interface Props {
  scenarioName: string;
  scenario: Scenario;
  /** Source of each branch's full action log, for the per-branch drill-down. */
  run: BranchRun;
  summary: BranchSummary;
  branches: BranchStripEntry[];
  onSubmit: (name: string) => void;
  onDismiss: () => void;
  defaultName?: string;
  signedInName?: string;
  /** Submission failure — keeps the dialog open so the player can retry. */
  error?: string;
  seriesMode?: boolean;
  continueLabel?: string;
  onReviewBoard?: () => void;
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
 *
 * Every branch row is a way in: clicking one swaps this same dialog to that
 * branch's own play diagram and move table — the identical view a completed
 * single-line puzzle gets, just scoped to one path through this run instead of
 * the whole board. `run` carries the full action log behind each row; `branches`
 * only carries the summary numbers the list itself needs.
 */
export function BranchRunSummary({
  scenarioName, scenario, run, summary, branches, onSubmit, onDismiss, defaultName, signedInName, error,
  seriesMode = false, continueLabel, onReviewBoard,
}: Props) {
  const titleId = useId();
  const ref = useModalFocus<HTMLDivElement>(onDismiss);
  const [name, setName] = useState(defaultName ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

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
  const detail = detailId ? branches.find(b => b.id === detailId) ?? null : null;
  const tree = branchTreeView(run);

  return (
    <div className="modal-backdrop">
      <div
        ref={ref}
        className={`modal branch-summary${detail ? ' branch-summary--detail' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        {detail ? (
          <>
            <header className="branch-summary__detail-header">
              <button type="button" className="branch-summary__back" onClick={() => setDetailId(null)}>
                <span aria-hidden="true">←</span>
                <span>Back to summary</span>
              </button>
              <p className="branch-summary__detail-kicker">Universe review</p>
              <h2
                id={titleId}
                className="modal__title branch-summary__detail-title"
                aria-label={`Universe ${detail.number}: ${detail.path}`}
              >
                <span>Universe {detail.number}</span>
                {' '}
                <span className="branch-summary__detail-outcome" aria-hidden="true">{detail.label}</span>
              </h2>
              <p className="branch-summary__detail-path" title={detail.path}>{detail.path}</p>
            </header>
            <div className="branch-summary__detail-scroll" data-testid="branch-detail-scroll">
              <ActionLogDetail
                scenario={scenario}
                actionLog={run.lines[detail.id].state.actionLog}
                variant="review"
                diagramAside={tree && (
                  <BranchReviewGraphic tree={tree} highlightedBranchId={detail.id} />
                )}
              />
            </div>
          </>
        ) : (
          <>
            <h2 id={titleId} className="modal__title">{scenarioName}: run complete</h2>

            <p className="branch-summary__score">
              <strong>{pct(summary.score)}</strong>
              <span>OBJECTIVE CHANCE</span>
            </p>

            <dl className="branch-summary__breakdown">
              <div>
                <dt>Universes scored</dt>
                <dd>{scored.length} of {branches.length}</dd>
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

            {tree && <BranchTreeGraphic tree={tree} />}

            <ul className="branch-summary__branches" aria-label="Parallel Universes">
              {branches.map(branch => (
                <li key={branch.id}>
                  <button
                    type="button"
                    className={`branch-summary__branch branch-summary__branch--${branch.status}`}
                    aria-label={`View Universe ${branch.number}: ${branch.path}`}
                    onClick={() => setDetailId(branch.id)}
                  >
                    <span className="branch-summary__branch-path" title={branch.path}>
                      <span className="branch-summary__branch-number">Universe {branch.number}</span>
                      <span className="branch-summary__branch-outcome">{branch.label}</span>
                    </span>
                    <span className="branch-summary__branch-weight">{pct(branch.weight)}</span>
                    <span className="branch-summary__branch-value">
                      {branch.status === 'conceded' ? 'given up' : `scores ${pct(branch.value)}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {error && <p className="submit-modal__error" role="alert">{error}</p>}

            {seriesMode ? null : signedInName ? (
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
                {submitting ? 'Saving...' : error ? 'Try Again' : seriesMode ? continueLabel ?? 'Continue' : 'Submit Score'}
              </button>
              {onReviewBoard ? (
                <button className="modal__continue-btn" disabled={submitting} onClick={onReviewBoard}>
                  Review Board
                </button>
              ) : (
                <button className="modal__continue-btn" disabled={submitting} onClick={onDismiss}>
                  Skip
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
