import type { BranchStripEntry } from './branchRun';
import './BranchStrip.css';

interface Props {
  branches: BranchStripEntry[];
  /** Probability lost to blocks that put the attacker down. */
  deadWeight: number;
  /** The run's honest expected value so far. */
  score: number;
  onSelect: (id: string) => void;
  onConcede: (id: string) => void;
}

const STATUS_LABEL: Record<BranchStripEntry['status'], string> = {
  'scored': 'Scored',
  'conceded': 'Given up',
  'needs-attention': 'Needs a plan',
  'authoring': 'Following',
};

function pct(value: number): string {
  if (value > 0 && value < 0.005) return '<1%';
  return `${Math.round(value * 100)}%`;
}

/**
 * The live list of boards the block left behind.
 *
 * Weights here move while the player authors, and that is correct rather than a
 * glitch: with two or three dice the attacker takes the best board they are
 * offered, so making one branch more valuable makes it more likely. It is the
 * single most instructive thing this model shows.
 */
export function BranchStrip({ branches, deadWeight, score, onSelect, onConcede }: Props) {
  if (branches.length <= 1) return null;

  const needsAttention = branches.filter(b => b.status === 'needs-attention').length;
  const unresolved = branches.filter(b => b.status === 'authoring' || b.status === 'needs-attention');

  return (
    <section className="branch-strip" aria-label="Parallel Universes">
      <header className="branch-strip__header">
        <span className="branch-strip__score">
          Scoring chance <strong>{pct(score)}</strong>
        </span>
        {deadWeight > 0 && (
          <span className="branch-strip__dead" title="Blocks that put your own player down end the drive">
            {pct(deadWeight)} already lost
          </span>
        )}
        {needsAttention > 0 && (
          <span className="branch-strip__alert" role="status">
            {needsAttention} universe{needsAttention === 1 ? '' : 's'} unresolved
          </span>
        )}
      </header>

      <ul className="branch-strip__list">
        {branches.map(branch => (
          <li key={branch.id}>
            <button
              type="button"
              className={[
                'branch-chip',
                `branch-chip--${branch.status}`,
                branch.isViewed ? 'branch-chip--viewed' : '',
              ].filter(Boolean).join(' ')}
              aria-current={branch.isViewed ? 'true' : undefined}
              onClick={() => onSelect(branch.id)}
            >
              <span className="branch-chip__label">{branch.path}</span>
              <span className="branch-chip__weight">{pct(branch.weight)}</span>
              <span className="branch-chip__status">{STATUS_LABEL[branch.status]}</span>
            </button>
            {branch.status !== 'scored' && branch.status !== 'conceded' && (
              <button
                type="button"
                className="branch-chip__concede"
                title={`Give up on "${branch.path}"; cost ${pct(branch.weight)}`}
                aria-label={`Give up on ${branch.path}`}
                onClick={() => onConcede(branch.id)}
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>

      {unresolved.length > 0 && (
        <p className="branch-strip__hint">
          Resolve every universe. Score or give it up.
        </p>
      )}
    </section>
  );
}
