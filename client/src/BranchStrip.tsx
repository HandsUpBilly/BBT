import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { BranchStripEntry, BranchTreeBlockView, BranchTreeStateView } from './branchRun';
import { branchTreeStripGrid } from './branchTreeStrips';
import { BlockFaceGraphic } from './BlockDiceGraphic';
import { ConfirmDialog } from './ConfirmDialog';
import './BranchStrip.css';

interface Props {
  branches: BranchStripEntry[];
  tree: BranchTreeBlockView | null;
  /** Probability lost to blocks that put the attacker down. */
  deadWeight: number;
  /** The run's honest expected value so far. */
  score: number;
  spotlight?: boolean;
  onDismissSpotlight?: () => void;
  onSelect: (id: string) => void;
  onReset: (id: string) => void;
  onResetToBranchPoint: (id: string) => void;
  onConcede: (id: string) => void;
}

const STATUS_LABEL: Record<BranchTreeStateView['status'], string> = {
  'scored': 'Scored',
  'conceded': 'Given up',
  'needs-attention': 'Needs a plan',
  'authoring': 'Following',
  'continued': 'Branched',
};

/** A fixed outcome card plus the widest reset/rewind/give-up control rail. */
const BRANCH_TRACK_WIDTH = 328;
const BRANCH_TRACK_GAP = 6;

function pct(value: number): string {
  if (value > 0 && value < 0.005) return '<1%';
  return `${Math.round(value * 100)}%`;
}

/** A historical state is complete only when every ending universe below it scored. */
function allDescendantsScored(block: BranchTreeBlockView): boolean {
  return block.states.length > 0 && block.states.every(state =>
    state.nextBlock ? allDescendantsScored(state.nextBlock) : state.status === 'scored');
}

function descendantStateCount(state: BranchTreeStateView): number {
  if (!state.nextBlock) return 0;
  return state.nextBlock.states.reduce(
    (total, child) => total + 1 + descendantStateCount(child),
    0,
  );
}

function StateCard({
  state, onSelect, onReset, onRequestReset, onRequestConcede,
}: {
  state: BranchTreeStateView;
  onSelect: (id: string) => void;
  onReset: (id: string) => void;
  onRequestReset: (state: BranchTreeStateView) => void;
  onRequestConcede: (state: BranchTreeStateView) => void;
}) {
  const outcome = state.outcomes[state.outcomes.length - 1];
  const descendantsScored = state.status === 'continued'
    && state.nextBlock !== undefined
    && allDescendantsScored(state.nextBlock);
  const statusLabel = descendantsScored ? 'All branches scored' : STATUS_LABEL[state.status];
  const classes = [
    'branch-chip',
    `branch-chip--${state.status}`,
    descendantsScored ? 'branch-chip--complete' : '',
    state.isViewed ? 'branch-chip--viewed' : '',
    !state.isSelectable ? 'branch-chip--historical' : '',
  ].filter(Boolean).join(' ');
  const label = `Universe ${state.number}: ${state.path}; ${pct(state.weight)}; ${statusLabel}`;
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
      <span className="branch-chip__weight">{pct(state.weight)}</span>
      <span className="branch-chip__status">{statusLabel}</span>
    </>
  );

  return (
    <div className="branch-strip-state__actions">
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
      {state.isSelectable && state.canResetActivation && (
        <button
          type="button"
          className="branch-chip__reset"
          title={`Reset the partial move in Universe ${state.number}`}
          aria-label={`Reset partial move in Universe ${state.number}`}
          onClick={() => onReset(state.id)}
        >
          Reset move
        </button>
      )}
      {state.canResetBranchPoint && (
        <button
          type="button"
          className="branch-chip__rewind"
          title={`Reset Universe ${state.number} to its branching point`}
          aria-label={`Reset Universe ${state.number} to its branching point`}
          onClick={() => onRequestReset(state)}
        >
          <span aria-hidden="true">↺</span>
        </button>
      )}
      {state.isSelectable && state.status !== 'scored' && state.status !== 'conceded' && (
        <button
          type="button"
          className="branch-chip__concede"
          title={`Give up on "${state.path}"; cost ${pct(state.weight)}`}
          aria-label={`Give up on ${state.path}`}
          onClick={() => onRequestConcede(state)}
        >
          <span aria-hidden="true">⚐</span>
        </button>
      )}
    </div>
  );
}

function treeGridStyle(leafColumns: number): CSSProperties {
  const width = leafColumns * BRANCH_TRACK_WIDTH
    + Math.max(0, leafColumns - 1) * BRANCH_TRACK_GAP;
  return {
    gridTemplateColumns: `repeat(${leafColumns}, ${BRANCH_TRACK_WIDTH}px)`,
    width: `${width}px`,
  };
}

function placementStyle(startColumn: number, columnSpan: number): CSSProperties {
  return { gridColumn: `${startColumn + 1} / span ${columnSpan}` };
}

function placementWidth(columnSpan: number): number {
  return columnSpan * BRANCH_TRACK_WIDTH
    + Math.max(0, columnSpan - 1) * BRANCH_TRACK_GAP;
}

function guideStyle(
  placement: ReturnType<typeof branchTreeStripGrid>['strips'][number]['blocks'][number],
): CSSProperties {
  const firstState = placement.states[0];
  const lastState = placement.states[placement.states.length - 1];
  const columnPitch = BRANCH_TRACK_WIDTH + BRANCH_TRACK_GAP;
  const firstCentre = (firstState.startColumn - placement.startColumn) * columnPitch
    + placementWidth(firstState.columnSpan) / 2;
  const lastCentre = (lastState.startColumn - placement.startColumn) * columnPitch
    + placementWidth(lastState.columnSpan) / 2;
  return {
    ...placementStyle(placement.startColumn, placement.columnSpan),
    '--branch-guide-left': `${firstCentre}px`,
    '--branch-guide-right': `${placementWidth(placement.columnSpan) - lastCentre}px`,
  } as CSSProperties;
}

function blockMatchups(blocks: BranchTreeBlockView[]) {
  return [...new Map(blocks.map(block => [
    `${block.blockLabel}:${block.diceCount}`,
    block,
  ])).values()];
}

function BlockMatchup({ block }: { block: BranchTreeBlockView }) {
  const [attacker, defender] = block.blockLabel.split(' ⚔ ');
  return (
    <div className="branch-strip-row__matchup" aria-label={`${block.blockLabel}, ${block.diceCount} ${block.diceCount === 1 ? 'die' : 'dice'}`}>
      <span className="branch-strip-row__players">
        <strong>{attacker}</strong>
        {defender ? <><small>blocked</small><strong>{defender}</strong></> : null}
      </span>
      <span className="branch-strip-row__dice-count">
        {block.diceCount} {block.diceCount === 1 ? 'die' : 'dice'}
      </span>
    </div>
  );
}

/** One block depth per row, with each Block's immediate outcomes kept compact. */
export function BranchStrip({
  branches, tree, deadWeight, score, spotlight = false,
  onDismissSpotlight,
  onSelect, onReset, onResetToBranchPoint, onConcede,
}: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const [hideNeedsAttention, setHideNeedsAttention] = useState(false);
  const [collapseCompleted, setCollapseCompleted] = useState(false);
  const [pendingConcede, setPendingConcede] = useState<BranchTreeStateView | null>(null);
  const [pendingReset, setPendingReset] = useState<BranchTreeStateView | null>(null);

  useEffect(() => {
    if (spotlight) sectionRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [spotlight]);

  if (branches.length <= 1) return null;

  const needsAttention = branches.filter(branch => branch.status === 'needs-attention');
  const completed = branches.filter(branch => branch.status === 'scored');
  const unresolved = branches.filter(branch => branch.status === 'authoring' || branch.status === 'needs-attention');
  const layout = tree
    ? branchTreeStripGrid(tree, state =>
        (!hideNeedsAttention || state.status !== 'needs-attention')
        && (!collapseCompleted || state.status !== 'scored'))
    : null;

  function toggleNeedsAttentionFilter() {
    const willHide = !hideNeedsAttention;
    if (willHide && branches.some(branch => branch.isViewed && branch.status === 'needs-attention')) {
      const fallback = branches.find(branch =>
        branch.status !== 'needs-attention'
        && (!collapseCompleted || branch.status !== 'scored'));
      if (fallback) onSelect(fallback.id);
    }
    setHideNeedsAttention(willHide);
  }

  function toggleCompletedCollapse() {
    const willCollapse = !collapseCompleted;
    if (willCollapse && branches.some(branch => branch.isViewed && branch.status === 'scored')) {
      const fallback = branches.find(branch =>
        branch.status !== 'scored'
        && (!hideNeedsAttention || branch.status !== 'needs-attention'));
      if (fallback) onSelect(fallback.id);
    }
    setCollapseCompleted(willCollapse);
  }

  return (
    <>
      <section ref={sectionRef} className={`branch-strip${spotlight ? ' branch-strip--spotlight' : ''}`} aria-label="Parallel Universes">
      {spotlight && (
        <aside className="branch-strip__introduction" aria-labelledby="universe-strip-introduction-title">
          <div>
            <span className="branch-strip__introduction-kicker">This is the universe strip</span>
            <strong id="universe-strip-introduction-title">Each card is a live board created by the Block.</strong>
            <p>Select every unfinished universe and complete the objective there. Each card keeps its share of the total scoring chance.</p>
          </div>
          {onDismissSpotlight && (
            <button type="button" onClick={onDismissSpotlight}>Dismiss</button>
          )}
        </aside>
      )}
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
        <div className="branch-tree-nav__filters">
          {completed.length > 0 && (
            <button
              type="button"
              className="branch-tree-nav__filter"
              aria-pressed={collapseCompleted}
              onClick={toggleCompletedCollapse}
            >
              {collapseCompleted ? 'Show' : 'Collapse'} completed branches ({completed.length})
            </button>
          )}
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
      </div>

      <div className="branch-tree-nav__scroll">
        {layout && layout.leafColumns > 0 ? (
          <div className="branch-tree-strips">
            {layout.strips.map((strip, stripIndex) => {
              const gridStyle = treeGridStyle(layout.leafColumns);
              const matchups = blockMatchups(strip.blocks.map(placement => placement.block));
              return (
                <section
                  className="branch-strip-row"
                  key={strip.blockNumber}
                  aria-label={`Block ${strip.blockNumber} states`}
                >
                  <header className="branch-strip-row__label">
                    <strong>Block {strip.blockNumber}</strong>
                    {matchups.map(block => <BlockMatchup key={`${block.blockLabel}:${block.diceCount}`} block={block} />)}
                  </header>
                  <div className="branch-strip-row__content" style={{ width: gridStyle.width }}>
                    {stripIndex > 0 && (
                      <div className="branch-strip-row__guides" style={gridStyle} aria-hidden="true">
                        {strip.blocks.map(placement => (
                          <span
                            className="branch-strip-row__guide"
                            key={`${placement.block.id}-${placement.startColumn}`}
                            style={guideStyle(placement)}
                          />
                        ))}
                      </div>
                    )}
                    <ul className="branch-strip-row__states" style={gridStyle}>
                      {strip.blocks.flatMap(placement => placement.states.map(statePlacement => (
                        <li
                          className="branch-strip-state"
                          key={statePlacement.state.id}
                          style={placementStyle(statePlacement.startColumn, statePlacement.columnSpan)}
                          data-branch-id={statePlacement.state.id}
                          data-column-start={statePlacement.startColumn}
                          data-column-span={statePlacement.columnSpan}
                        >
                          <StateCard
                            state={statePlacement.state}
                            onSelect={onSelect}
                            onReset={onReset}
                            onRequestReset={setPendingReset}
                            onRequestConcede={setPendingConcede}
                          />
                        </li>
                      )))}
                    </ul>
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <p className="branch-tree-nav__empty">
            {collapseCompleted && completed.length === branches.length
              ? 'All completed branches are collapsed.'
              : 'All filtered branches are hidden.'}
          </p>
        )}
      </div>

      {unresolved.length > 0 && (
        <p className="branch-strip__hint">Resolve every universe. Score or give it up.</p>
      )}
      </section>
      {pendingConcede && (
        <ConfirmDialog
          title={`Give up on Universe ${pendingConcede.number}?`}
          message={`This removes its ${pct(pendingConcede.weight)} chance from your scoring plan.`}
          confirmLabel="Give Up"
          destructive
          onCancel={() => setPendingConcede(null)}
          onConfirm={() => {
            onConcede(pendingConcede.id);
            setPendingConcede(null);
          }}
        />
      )}
      {pendingReset && (
        <ConfirmDialog
          title={`Reset Universe ${pendingReset.number}?`}
          message={descendantStateCount(pendingReset) > 0
            ? `This returns the branch to its branching point and removes ${descendantStateCount(pendingReset)} child ${descendantStateCount(pendingReset) === 1 ? 'branch' : 'branches'}.`
            : 'This discards all play in this universe and returns it to its branching point.'}
          confirmLabel="Reset Branch"
          destructive
          onCancel={() => setPendingReset(null)}
          onConfirm={() => {
            onResetToBranchPoint(pendingReset.id);
            setPendingReset(null);
          }}
        />
      )}
    </>
  );
}
