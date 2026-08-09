import type { ActionLogEntry } from './types';
import { compactDisplayLog, entryHasRoll } from './actionLogDisplay';
import './DiceLog.css';

interface Props {
  log: ActionLogEntry[];
}

function pct(p: number): string { return `${(p * 100).toFixed(1)}%`; }

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

function colLabel(col: number): string { return String.fromCharCode(65 + col); }
function posLabel(p: { col: number; row: number }): string { return `${colLabel(p.col)}${p.row + 1}`; }

function entryClass(e: ActionLogEntry): string {
  if (e.kind === 'handoff')    return 'dice-log__entry--handoff';
  if (e.kind === 'pass')       return 'dice-log__entry--pass';
  if (e.kind === 'pass-catch') return 'dice-log__entry--pass-catch';
  if (e.kind === 'block')      return 'dice-log__entry--block';
  if (e.kind === 'move' && e.pickupTarget) return 'dice-log__entry--pickup';
  if (e.isGfi && e.dodgeTarget !== null) return 'dice-log__entry--gfi-dodge';
  if (e.isGfi) return 'dice-log__entry--gfi';
  if (e.dodgeTarget !== null) return 'dice-log__entry--dodge';
  return 'dice-log__entry--move';
}


export function DiceLog({ log }: Props) {
  // The side column reserves its width regardless, so rendering nothing left
  // roughly 220px of blank rail at the start of every puzzle — until the
  // first move appeared out of it. Saying so costs the same space and reads
  // as a panel waiting for input rather than a layout bug.
  if (log.length === 0) {
    return (
      <div className="dice-log dice-log--empty">
        <div className="dice-log__title">Action Log</div>
        <p className="dice-log__empty">
          Moves and rolls appear here as you commit them.
        </p>
      </div>
    );
  }

  // The last entry's cumulativeProb is the product of every roll committed
  // this turn, and is exactly what gets submitted as the score.
  //
  // This used to be multiplied by state.pendingProb as well. pendingProb
  // resets on each activation and accumulates the same per-step values, so it
  // is always a subset of what cumulativeProb already holds — the current
  // piece's rolls were counted twice. Two Go For It rushes reported 48.2%
  // (0.833⁴) where the honest figure, and the score actually recorded, was
  // 69.4% (0.833²).
  const overallProb = log[log.length - 1].cumulativeProb;
  const hasRoll = log.some(entryHasRoll);
  const displayLog = compactDisplayLog(log);

  return (
    <div className="dice-log">
      <div className="dice-log__title">Action Log</div>

      {displayLog.map((entry, i) => (
        <div key={i} className={`dice-log__entry ${entryClass(entry)}`}>
          <span className="dice-log__icon">→</span>
          <span className="dice-log__detail">
            <span className="dice-log__piece">
              {entry.kind === 'handoff'
                ? `${entry.pieceName} → ${entry.receiverName}`
                : entry.kind === 'pass'
                ? `${entry.pieceName} → ${entry.receiverName}`
                : entry.kind === 'block'
                ? `${entry.pieceName} ⚔ ${entry.receiverName}`
                : entry.pieceName}
            </span>
            {' '}{posLabel(entry.from)} → {posLabel(entry.to)}
          </span>
          {entry.kind === 'handoff' ? (
            <span className="dice-log__prob">
              <span className="dice-log__handoff-tag">Catch {entry.catchTarget}+</span>
              {' '}<span className="dice-log__prob-pct">({pct(entry.actionProb)})</span>
            </span>
          ) : entry.kind === 'pass' ? (
            <span className="dice-log__prob">
              <span className="dice-log__pass-tag">{BAND_LABEL[entry.rangeBand]} {entry.passTarget}+</span>
              {' '}<span className="dice-log__prob-pct">({pct(entry.actionProb)})</span>
            </span>
          ) : entry.kind === 'pass-catch' ? (
            <span className="dice-log__prob">
              <span className="dice-log__pass-catch-tag">Catch {entry.catchTarget}+</span>
              {' '}<span className="dice-log__prob-pct">({pct(entry.actionProb)})</span>
            </span>
          ) : entry.kind === 'block' ? (
            <span className="dice-log__prob">
              <span className="dice-log__block-tag">
                {entry.diceCount}D {entry.picker === 'attacker' ? 'Att' : 'Def'} pick
              </span>
              {' '}<span className="dice-log__block-face">{FACE_LABEL[entry.resolvedFace]}</span>
              {' '}<span className="dice-log__prob-pct">({pct(entry.actionProb)})</span>
            </span>
          ) : (entry.isGfi || entry.dodgeTarget !== null || !!entry.pickupTarget) && (
            <span className="dice-log__prob">
              {entry.isGfi && <span className="dice-log__gfi-tag">GFI 2+</span>}
              {entry.dodgeTarget !== null && (
                <span>{entry.dodgeTarget}+</span>
              )}
              {!!entry.pickupTarget && (
                <span className="dice-log__pickup-tag">Pickup {entry.pickupTarget}+</span>
              )}
              <span className="dice-log__prob-pct">({pct(entry.actionProb)})</span>
            </span>
          )}
        </div>
      ))}

      {hasRoll && (
        <div className="dice-log__prob-row">
          <span className="dice-log__prob-label">Cumulative</span>
          <span className={`dice-log__prob-total ${overallProb < 0.5 ? 'dice-log__prob-total--risky' : ''}`}>
            {pct(overallProb)}
          </span>
        </div>
      )}
    </div>
  );
}
