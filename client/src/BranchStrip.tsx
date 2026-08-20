import { useState } from 'react';
import type { BranchStripEntry, BranchTreeBlockView, BranchTreeStateView } from './branchRun';
import { BlockFaceGraphic } from './BlockDiceGraphic';
import './BranchStrip.css';

interface Props {
  branches: BranchStripEntry[];
  tree: BranchTreeBlockView | null;
  /** Probability lost to blocks that put the attacker down. */
  deadWeight: number;
  /** The run's honest expected value so far. */
  score: number;
  onSelect: (id: string) => void;
  onConcede: (id: string) => void;
}

const STATUS_LABEL: Record<BranchTreeStateView['status'], string> = {
  'scored': 'Scored',
  'conceded': 'Given up',
  'needs-attention': 'Needs a plan',
  'authoring': 'Following',
  'continued': 'Branched',
};

function pct(value: number): string {
  if (value > 0 && value < 0.005) return '<1%';
  return `${Math.round(value * 100)}%`;
}

function stateIsVisible(state: BranchTreeStateView, hideNeedsAttention: boolean): boolean {
  if (!hideNeedsAttention) return true;
  if (state.nextBlock) {
    return state.nextBlock.states.some(child => stateIsVisible(child, true));
  }
  return state.status !== 'needs-attention';
}

interface BlockNodeProps {
  block: BranchTreeBlockView;
  hideNeedsAttention: boolean;
  onSelect: (id: string) => void;
  onConcede: (id: string) => void;
}

function BlockNode({ block, hideNeedsAttention, onSelect, onConcede }: BlockNodeProps) {
  const visibleStates = block.states.filter(state => stateIsVisible(state, hideNeedsAttention));

  return (
    <section className="branch-tree-nav__block" aria-label={`Block ${block.blockNumber}: ${block.blockLabel}`}>
      <header className="branch-tree-nav__block-node">
        <strong>Block {block.blockNumber}</strong>
        <span>{block.blockLabel}</span>
        <small>{block.diceCount} {block.diceCount === 1 ? 'die' : 'dice'}</small>
      </header>
      <ul className="branch-tree-nav__states">
        {visibleStates.map(state => (
          <StateNode
            key={state.id}
            state={state}
            hideNeedsAttention={hideNeedsAttention}
            onSelect={onSelect}
            onConcede={onConcede}
          />
        ))}
      </ul>
    </section>
  );
}

interface StateNodeProps extends Omit<BlockNodeProps, 'block'> {
  state: BranchTreeStateView;
}

function StateNode({ state, hideNeedsAttention, onSelect, onConcede }: StateNodeProps) {
  const outcome = state.outcomes[state.outcomes.length - 1];
  const classes = [
    'branch-chip',
    `branch-chip--${state.status}`,
    state.isViewed ? 'branch-chip--viewed' : '',
    !state.isSelectable ? 'branch-chip--historical' : '',
  ].filter(Boolean).join(' ');
  const label = `${state.path}; ${pct(state.weight)}; ${STATUS_LABEL[state.status]}`;
  const content = (
    <>
      {outcome && (
        <span className="branch-chip__dice" aria-hidden="true">
          {outcome.faces.map(face => (
            <BlockFaceGraphic
              key={face}
              face={face}
              favor={outcome.favor}
              size={28}
              className="branch-chip__die"
            />
          ))}
        </span>
      )}
      <span className="branch-chip__outcome">{state.label}</span>
      <span className="branch-chip__weight">{pct(state.weight)}</span>
      <span className="branch-chip__status">{STATUS_LABEL[state.status]}</span>
    </>
  );

  return (
    <li className="branch-tree-nav__state">
      <div className="branch-tree-nav__state-row">
        {state.isSelectable ? (
          <button
            type="button"
            className={classes}
            aria-current={state.isViewed ? 'true' : undefined}
            aria-label={label}
            onClick={() => onSelect(state.id)}
          >
            {content}
          </button>
        ) : (
          <div className={classes} aria-label={label}>{content}</div>
        )}
        {state.isSelectable && state.status !== 'scored' && state.status !== 'conceded' && (
          <button
            type="button"
            className="branch-chip__concede"
            title={`Give up on "${state.path}"; cost ${pct(state.weight)}`}
            aria-label={`Give up on ${state.path}`}
            onClick={() => onConcede(state.id)}
          >
            ✕
          </button>
        )}
      </div>
      {state.nextBlock && (
        <BlockNode
          block={state.nextBlock}
          hideNeedsAttention={hideNeedsAttention}
          onSelect={onSelect}
          onConcede={onConcede}
        />
      )}
    </li>
  );
}

/** The live parent-child tree of boards left behind by each block. */
export function BranchStrip({ branches, tree, deadWeight, score, onSelect, onConcede }: Props) {
  const [hideNeedsAttention, setHideNeedsAttention] = useState(false);

  if (branches.length <= 1) return null;

  const needsAttention = branches.filter(branch => branch.status === 'needs-attention');
  const unresolved = branches.filter(branch => branch.status === 'authoring' || branch.status === 'needs-attention');
  const hasVisibleStates = tree?.states.some(state => stateIsVisible(state, hideNeedsAttention)) ?? false;

  function toggleNeedsAttentionFilter() {
    const willHide = !hideNeedsAttention;
    if (willHide && branches.some(branch => branch.isViewed && branch.status === 'needs-attention')) {
      const fallback = branches.find(branch => branch.status !== 'needs-attention');
      if (fallback) onSelect(fallback.id);
    }
    setHideNeedsAttention(willHide);
  }

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
        {needsAttention.length > 0 && (
          <span className="branch-strip__alert" role="status">
            {needsAttention.length} universe{needsAttention.length === 1 ? '' : 's'} unresolved
          </span>
        )}
      </header>

      <div className="branch-tree-nav__toolbar">
        <strong>Game tree</strong>
        {needsAttention.length > 0 && (
          <button
            type="button"
            className="branch-tree-nav__filter"
            aria-pressed={hideNeedsAttention}
            onClick={toggleNeedsAttentionFilter}
          >
            {hideNeedsAttention ? 'Show' : 'Hide'} branches needing extra actions ({needsAttention.length})
          </button>
        )}
      </div>

      <div className="branch-tree-nav__scroll">
        {tree && hasVisibleStates ? (
          <BlockNode
            block={tree}
            hideNeedsAttention={hideNeedsAttention}
            onSelect={onSelect}
            onConcede={onConcede}
          />
        ) : (
          <p className="branch-tree-nav__empty">All branches needing extra actions are hidden.</p>
        )}
      </div>

      {unresolved.length > 0 && (
        <p className="branch-strip__hint">Resolve every universe. Score or give it up.</p>
      )}
    </section>
  );
}
