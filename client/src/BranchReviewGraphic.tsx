import type { BranchTreeBlockView, BranchTreeStateView } from './branchRun';
import { branchTreeContains, branchTreeStripGrid } from './branchTreeStrips';
import { blockFaceImage } from './BlockDiceGraphic';
import './BranchReviewGraphic.css';

const COLUMN_WIDTH = 126;
const ROW_HEIGHT = 94;
const LABEL_WIDTH = 54;
const MARGIN = 16;
const DIE_SIZE = 22;

interface Props {
  tree: BranchTreeBlockView;
  highlightedBranchId: string;
}

interface StatePoint {
  state: BranchTreeStateView;
  x: number;
  y: number;
  highlighted: boolean;
  selected: boolean;
}

interface Route {
  from: StatePoint;
  to: StatePoint;
}

function shorten(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function pointHighlights(state: BranchTreeStateView, branchId: string): boolean {
  return state.id === branchId
    || (state.nextBlock ? branchTreeContains(state.nextBlock, branchId) : false);
}

/** Lightweight playbook route for the universe currently being reviewed. */
export function BranchReviewGraphic({ tree, highlightedBranchId }: Props) {
  const layout = branchTreeStripGrid(tree);
  const points = new Map<string, StatePoint>();
  const rootX = LABEL_WIDTH + MARGIN + layout.leafColumns * COLUMN_WIDTH / 2;
  const rootY = MARGIN + 8;

  layout.strips.forEach((strip, depth) => {
    strip.blocks.forEach(block => {
      block.states.forEach(placement => {
        points.set(placement.state.id, {
          state: placement.state,
          x: LABEL_WIDTH + MARGIN + (placement.startColumn + placement.columnSpan / 2) * COLUMN_WIDTH,
          y: MARGIN + 68 + depth * ROW_HEIGHT,
          highlighted: pointHighlights(placement.state, highlightedBranchId),
          selected: placement.state.id === highlightedBranchId,
        });
      });
    });
  });

  const routes: Route[] = [];
  layout.strips.slice(1).forEach(strip => {
    strip.blocks.forEach(block => {
      const parent = points.get(block.block.id);
      if (!parent) return;
      block.states.forEach(placement => {
        const child = points.get(placement.state.id);
        if (child) routes.push({ from: parent, to: child });
      });
    });
  });

  const firstRowPoints = layout.strips[0]?.blocks.flatMap(block =>
    block.states.map(placement => points.get(placement.state.id)).filter((point): point is StatePoint => !!point)) ?? [];

  const width = LABEL_WIDTH + MARGIN * 2 + layout.leafColumns * COLUMN_WIDTH;
  const height = MARGIN * 2 + 108 + Math.max(0, layout.strips.length - 1) * ROW_HEIGHT;

  return (
    <figure className="branch-review">
      <div className="branch-review__heading">Branch playbook</div>
      <div className="branch-review__scroll">
        <svg
          className="branch-review__svg"
          style={{ minWidth: `${width}px` }}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Game branch tree with ${layout.strips.length} ${layout.strips.length === 1 ? 'block' : 'blocks'} and ${layout.leafColumns} ending ${layout.leafColumns === 1 ? 'universe' : 'universes'}; reviewed branch highlighted`}
        >
          <g className="branch-review__routes" aria-hidden="true">
            {firstRowPoints.map(point => {
              const middleY = (rootY + point.y) / 2;
              return (
                <path
                  key={`root-${point.state.id}`}
                  className={point.highlighted ? 'branch-review__edge--highlighted' : undefined}
                  d={`M ${rootX} ${rootY} C ${rootX} ${middleY}, ${point.x} ${middleY}, ${point.x} ${point.y}`}
                />
              );
            })}
            {routes.map(route => {
              const middleY = (route.from.y + route.to.y) / 2;
              const highlighted = route.from.highlighted && route.to.highlighted;
              return (
                <path
                  key={`${route.from.state.id}-${route.to.state.id}`}
                  className={highlighted ? 'branch-review__edge--highlighted' : undefined}
                  d={`M ${route.from.x} ${route.from.y} C ${route.from.x} ${middleY}, ${route.to.x} ${middleY}, ${route.to.x} ${route.to.y}`}
                />
              );
            })}
          </g>

          {layout.strips.map((strip, depth) => (
            <text
              key={strip.blockNumber}
              className="branch-review__row-label"
              x="8"
              y={MARGIN + 71 + depth * ROW_HEIGHT}
            >
              BLOCK {strip.blockNumber}
            </text>
          ))}

          <g className="branch-review__root branch-review__root--highlighted">
            <circle cx={rootX} cy={rootY} r="4.5" />
            <text x={rootX + 10} y={rootY + 3}>START</text>
          </g>

          <g className="branch-review__nodes">
            {[...points.values()].map(point => {
              const outcome = point.state.outcomes[point.state.outcomes.length - 1];
              const faces = outcome?.faces ?? [];
              const diceWidth = faces.length * DIE_SIZE + Math.max(0, faces.length - 1) * 3;
              const diceX = point.x - diceWidth / 2;
              return (
                <g
                  key={point.state.id}
                  className={[
                    'branch-review__node',
                    point.highlighted ? 'branch-review__node--highlighted' : '',
                    point.selected ? 'branch-review__node--selected' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <title>{point.state.path}</title>
                  {faces.map((face, index) => (
                    <image
                      key={face}
                      className={`branch-review__die branch-review__die--${outcome?.favor ?? 'attacker'}`}
                      href={blockFaceImage(face, outcome?.favor ?? 'attacker')}
                      x={diceX + index * (DIE_SIZE + 3)}
                      y={point.y - 31}
                      width={DIE_SIZE}
                      height={DIE_SIZE}
                      preserveAspectRatio="xMidYMid meet"
                    />
                  ))}
                  <circle cx={point.x} cy={point.y} r={point.selected ? 6 : 4.5} />
                  <text x={point.x} y={point.y + 18}>{shorten(point.state.label, 18)}</text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <figcaption>The highlighted dotted route is the universe being reviewed.</figcaption>
    </figure>
  );
}
