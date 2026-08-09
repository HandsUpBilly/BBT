import type { LeaderboardEntry } from './types';
import './ScoreSummary.css';

interface Props {
  entry: LeaderboardEntry;
  onBack: () => void;
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
function actionLabel(m: LeaderboardEntry['moves'][number]): string {
  if (m.resolvedFace !== undefined) return `${m.isBlitz ? 'Blitz' : 'Block'} → ${FACE_LABEL[m.resolvedFace]}`;
  if (m.passTarget !== undefined && m.rangeBand)
    return `${BAND_LABEL[m.rangeBand]} Pass ${m.passTarget}+`;
  if (m.catchTarget !== undefined && m.passTarget === undefined && m.receiverName === undefined)
    return `Catch ${m.catchTarget}+`;   // pass-catch
  if (m.catchTarget !== undefined) return `Handoff ${m.catchTarget}+`;
  const pickupSuffix = m.pickupTarget ? ` · Pickup ${m.pickupTarget}+` : '';
  if (m.isGfi && m.dodgeTarget !== null) return `GFI 2+ · Dodge ${m.dodgeTarget}+${pickupSuffix}`;
  if (m.isGfi) return `Go For It 2+${pickupSuffix}`;
  if (m.dodgeTarget !== null) return `Dodge ${m.dodgeTarget}+${pickupSuffix}`;
  return `Pickup ${m.pickupTarget}+`;
}
function playerName(m: LeaderboardEntry['moves'][number]): string {
  if (m.resolvedFace !== undefined && m.receiverName) return `${m.pieceName} ⚔ ${m.receiverName}`;
  if (m.receiverName) return `${m.pieceName} → ${m.receiverName}`;
  return m.pieceName;
}
function playerRole(m: LeaderboardEntry['moves'][number]): string {
  const role = m.pieceRole;
  return role.charAt(0).toUpperCase() + role.slice(1);
}


export function ScoreSummary({ entry, onBack }: Props) {
  const moves = entry.moves ?? [];
  const cumProb = moves.length > 0 ? moves[moves.length - 1].cumulativeProb : entry.probability;

  return (
    <div className="score-summary">
      <div className="score-summary__header">
        <button className="lb-back-btn" onClick={onBack}>← Back</button>
        <div>
          <h2 className="score-summary__name">{entry.name}</h2>
          <p className="score-summary__meta">
            {new Date(entry.date).toLocaleDateString()} · {pct(entry.probability)}
          </p>
        </div>
      </div>

      {moves.length === 0 ? (
        <p className="score-summary__empty">No move data available for this entry.</p>
      ) : (
        <div className="score-summary__moves">
          <div className="score-summary__moves-header">
            <span>Player</span>
            <span>Type</span>
            <span>Move</span>
            <span>Action</span>
            <span className="score-summary__col-right">Chance</span>
          </div>
          {moves.map((m, i) => (
            <div key={i} className="score-summary__move-row">
              <span className="score-summary__move-name">{playerName(m)}</span>
              <span className="score-summary__move-role">{playerRole(m)}</span>
              <span className="score-summary__move-pos">{posLabel(m.from)} → {posLabel(m.to)}</span>
              <span className="score-summary__move-action">{actionLabel(m)}</span>
              <span className="score-summary__move-prob">{pct(m.actionProb)}</span>
            </div>
          ))}
          <div className="score-summary__cum-row">
            <span className="score-summary__cum-label">Cumulative probability</span>
            <span className={`score-summary__cum-value${cumProb < 0.5 ? ' score-summary__cum-value--risky' : ''}`}>
              {pct(cumProb)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
