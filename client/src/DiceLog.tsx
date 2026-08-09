import type { ActionLogEntry } from './types';
import './DiceLog.css';

interface Props {
  log: ActionLogEntry[];
  pendingProb: number;
  pendingTargets: number[];
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

function movementDirection(e: ActionLogEntry): string | null {
  if (e.kind !== 'move' || e.isGfi || e.dodgeTarget !== null) return null;
  return `${Math.sign(e.to.col - e.from.col)},${Math.sign(e.to.row - e.from.row)}`;
}

function compactDisplayLog(log: ActionLogEntry[]): ActionLogEntry[] {
  return log.reduce<ActionLogEntry[]>((entries, entry) => {
    const previous = entries[entries.length - 1];
    if (
      previous?.kind === 'move' &&
      entry.kind === 'move' &&
      previous.pieceName === entry.pieceName &&
      previous.pieceRole === entry.pieceRole &&
      previous.to.col === entry.from.col &&
      previous.to.row === entry.from.row &&
      movementDirection(previous) === movementDirection(entry)
    ) {
      entries[entries.length - 1] = {
        ...previous,
        to: entry.to,
        steps: previous.steps + entry.steps,
        cumulativeProb: entry.cumulativeProb,
      };
      return entries;
    }
    entries.push(entry);
    return entries;
  }, []);
}

export function DiceLog({ log, pendingProb }: Props) {
  if (log.length === 0) return null;

  const lastCumProb = log[log.length - 1].cumulativeProb;
  const overallProb = lastCumProb * pendingProb;
  const hasRoll = log.some(e =>
    e.kind === 'handoff' || e.kind === 'pass' || e.kind === 'pass-catch' || e.kind === 'block' ||
    e.isGfi || e.dodgeTarget !== null || (e.kind === 'move' && !!e.pickupTarget)
  );
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
