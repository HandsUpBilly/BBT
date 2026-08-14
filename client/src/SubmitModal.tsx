import { useState } from 'react';
import { PlayDiagram } from './PlayDiagram';
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

function pct(p: number) { return `${(p * 100).toFixed(1)}%`; }

const BAND_LABEL: Record<string, string> = {
  quick: 'Quick', short: 'Short', long: 'Long', bomb: 'Bomb',
};
const FACE_LABEL: Record<string, string> = {
  'attacker-down': 'Attacker Down',
  'both-down': 'Both Down',
  'push': 'Push Back',
  'defender-stumbles': 'Defender Stumbles',
  'defender-down': 'Defender Down',
};
function colLabel(col: number) { return String.fromCharCode(65 + col); }
function posLabel(p: { col: number; row: number }) { return `${colLabel(p.col)}${p.row + 1}`; }

function actionLabel(e: ActionLogEntry): string {
  if (e.kind === 'handoff')    return `Handoff ${e.catchTarget}+`;
  if (e.kind === 'pass')       return `${BAND_LABEL[e.rangeBand]} Pass ${e.passTarget}+`;
  if (e.kind === 'pass-catch') return `Catch ${e.catchTarget}+`;
  if (e.kind === 'block')      return `${e.isBlitz ? 'Blitz' : 'Block'} → ${FACE_LABEL[e.resolvedFace]}`;
  const pickupSuffix = e.kind === 'move' && e.pickupTarget ? ` · Pickup ${e.pickupTarget}+` : '';
  const rerollSuffix = e.kind === 'move' && e.dodgeSkillReroll ? ' (skill reroll)' : '';
  if (e.isGfi && e.dodgeTarget !== null) return `GFI 2+ · Dodge ${e.dodgeTarget}+${rerollSuffix}${pickupSuffix}`;
  if (e.isGfi) return `Go For It 2+${pickupSuffix}`;
  if (e.dodgeTarget !== null) return `Dodge ${e.dodgeTarget}+${rerollSuffix}${pickupSuffix}`;
  return `Pickup ${e.kind === 'move' ? e.pickupTarget : ''}+`;
}

function entryPlayerName(e: ActionLogEntry): string {
  if (e.kind === 'handoff') return `${e.pieceName} → ${e.receiverName}`;
  if (e.kind === 'pass')    return `${e.pieceName} → ${e.receiverName}`;
  if (e.kind === 'block')   return `${e.pieceName} ⚔ ${e.receiverName}`;
  return e.pieceName;
}

function entryRole(e: ActionLogEntry): string {
  if (e.kind === 'handoff')    return capitalize(e.receiverRole);
  if (e.kind === 'pass')       return capitalize(e.pieceRole);
  if (e.kind === 'pass-catch') return capitalize(e.pieceRole);
  if (e.kind === 'block')      return capitalize(e.pieceRole);
  return capitalize(e.pieceRole);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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

  const riskyMoves = actionLog.filter(e =>
    e.kind === 'handoff' || e.kind === 'pass' || e.kind === 'pass-catch' || e.kind === 'block' ||
    e.isGfi || e.dodgeTarget !== null || (e.kind === 'move' && !!e.pickupTarget)
  );
  const cumulativeProb = actionLog.length > 0
    ? actionLog[actionLog.length - 1].cumulativeProb
    : 1;

  return (
    <div className="modal-backdrop">
      <div className="modal submit-modal">
        <div className="submit-modal__td">
          <BallIcon className="submit-modal__td-ball" />
          TOUCHDOWN!
        </div>

        <PlayDiagram scenario={scenario} actionLog={actionLog} />

        {riskyMoves.length > 0 ? (
          <div className="submit-modal__moves">
            <div className="submit-modal__moves-scroll">
              <div className="submit-modal__moves-header">
                <span>Player</span>
                <span>Type</span>
                <span>Move</span>
                <span>Action</span>
                <span className="submit-modal__col-right">Chance</span>
              </div>
              {riskyMoves.map((entry, i) => (
                <div key={i} className="submit-modal__move-row">
                  <span className="submit-modal__move-name">{entryPlayerName(entry)}</span>
                  <span className="submit-modal__move-role">{entryRole(entry)}</span>
                  <span className="submit-modal__move-pos">{posLabel(entry.from)} → {posLabel(entry.to)}</span>
                  <span className="submit-modal__move-action">{actionLabel(entry)}</span>
                  <span className="submit-modal__move-prob">{pct(entry.actionProb)}</span>
                </div>
              ))}
            </div>
            <div className="submit-modal__cum-row">
              <span className="submit-modal__cum-label">Cumulative probability</span>
              <span className={`submit-modal__cum-value${cumulativeProb < 0.5 ? ' submit-modal__cum-value--risky' : ''}`}>
                {pct(cumulativeProb)}
              </span>
            </div>
          </div>
        ) : (
          <p className="submit-modal__no-risk">Clean run — no rolls needed!</p>
        )}

        {error && (
          <p className="submit-modal__error" role="alert">{error}</p>
        )}

        {seriesMode ? (
          <div className="submit-modal__actions">
            <button className="modal__roll-btn" disabled={submitting} onClick={() => runSubmit('')}>
              {submitting ? 'Saving…' : error ? 'Try Again' : continueLabel ?? 'Continue'}
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
                {submitting ? 'Saving…' : error ? 'Try Again' : 'Submit Score'}
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
