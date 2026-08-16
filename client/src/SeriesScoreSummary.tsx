import type { SeriesLeaderboardEntry } from './types';
import './ScoreSummary.css';

interface Props {
  entry: SeriesLeaderboardEntry;
  onBack: () => void;
}

function pct(p: number) { return `${(p * 100).toFixed(1)}%`; }
function dice(value: number) { return Number.isInteger(value) ? String(value) : value.toFixed(1); }

export function SeriesScoreSummary({ entry, onBack }: Props) {
  const puzzles = entry.puzzles ?? [];

  return (
    <div className="score-summary">
      <div className="score-summary__header">
        <button className="lb-back-btn" onClick={onBack}>← Back</button>
        <div>
          <h2 className="score-summary__name">{entry.name}</h2>
          <p className="score-summary__meta">
            {new Date(entry.date).toLocaleDateString()}, Average {pct(entry.probability)}
          </p>
        </div>
      </div>

      {puzzles.length === 0 ? (
        <p className="score-summary__empty">No puzzle data available for this run.</p>
      ) : (
        <div className="score-summary__moves">
          <div className="score-summary__moves-header">
            <span>Puzzle</span>
            <span></span>
            <span></span>
            <span></span>
            <span className="score-summary__col-right">Chance</span>
          </div>
          {puzzles.map((p, i) => (
            <div key={i} className="score-summary__move-row">
              <span className="score-summary__move-name">{p.scenarioName}</span>
              <span></span>
              <span></span>
              <span className="score-summary__move-action">{dice(p.diceCount)} roll{p.diceCount === 1 ? '' : 's'}</span>
              <span className="score-summary__move-prob">{pct(p.probability)}</span>
            </div>
          ))}
          <div className="score-summary__cum-row">
            <span className="score-summary__cum-label">Average probability</span>
            <span className={`score-summary__cum-value${entry.probability < 0.5 ? ' score-summary__cum-value--risky' : ''}`}>
              {pct(entry.probability)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
