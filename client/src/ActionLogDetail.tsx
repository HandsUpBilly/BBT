import { PlayDiagram } from './PlayDiagram';
import type { ActionLogEntry, Scenario } from './types';
import './SubmitModal.css'; // submit-modal__moves* classes, shared across every place this renders

interface Props {
  scenario: Scenario;
  actionLog: ActionLogEntry[];
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
  if (e.kind === 'handoff')    return `Hand-off ${e.catchTarget}+`;
  if (e.kind === 'pass')       return `${BAND_LABEL[e.rangeBand]} Pass ${e.passTarget}+`;
  if (e.kind === 'pass-catch') return `Catch ${e.catchTarget}+`;
  if (e.kind === 'block')      return `${e.isBlitz ? 'Blitz' : 'Block'} → ${FACE_LABEL[e.resolvedFace]}`;
  const pickupSuffix = e.kind === 'move' && e.pickupTarget ? `, Pickup ${e.pickupTarget}+` : '';
  const rerollSuffix = e.kind === 'move' && e.dodgeSkillReroll ? ' (skill reroll)' : '';
  if (e.isGfi && e.dodgeTarget !== null) return `Rush 2+, Dodge ${e.dodgeTarget}+${rerollSuffix}${pickupSuffix}`;
  if (e.isGfi) return `Rush 2+${pickupSuffix}`;
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

/**
 * The play diagram plus the risky-move table and cumulative-probability
 * footer — the "what actually happened" view of one action log against one
 * scenario. Shared by `SubmitModal` (the just-scored, not-yet-submitted line)
 * and the per-branch drill-down in `BranchRunSummary` (any completed or
 * conceded branch of a policy run), so this is the one place that knows how
 * to read an `ActionLogEntry[]` back into a human account of the play.
 */
export function ActionLogDetail({ scenario, actionLog }: Props) {
  const riskyMoves = actionLog.filter(e =>
    e.kind === 'handoff' || e.kind === 'pass' || e.kind === 'pass-catch' || e.kind === 'block' ||
    e.isGfi || e.dodgeTarget !== null || (e.kind === 'move' && !!e.pickupTarget)
  );
  const cumulativeProb = actionLog.length > 0
    ? actionLog[actionLog.length - 1].cumulativeProb
    : 1;

  return (
    <>
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
        <p className="submit-modal__no-risk">CLEAN PLAY: No rolls required.</p>
      )}
    </>
  );
}
