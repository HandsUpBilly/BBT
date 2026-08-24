import type { BranchTreeBlockView, BranchTreeStateView } from './branchRun';
import './BranchTreeGraphic.css';

const NODE_WIDTH = 174;
const NODE_HEIGHT = 52;
const COLUMN_GAP = 48;
const ROW_GAP = 72;
const MARGIN = 18;
const COLUMN_HEADER_HEIGHT = 30;

interface Props {
  tree: BranchTreeBlockView;
  /** Leaf whose full route should be picked out during per-branch review. */
  highlightedBranchId?: string;
}

interface LayoutNode {
  key: string;
  x: number;
  y: number;
  title: string;
  detail: string;
  description: string;
  kind: BranchTreeStateView['status'];
  highlighted: boolean;
  selected: boolean;
}

interface LayoutEdge {
  from: LayoutNode;
  to: LayoutNode;
}

function pct(value: number): string {
  if (value > 0 && value < 0.005) return '<1%';
  return `${Math.round(value * 100)}%`;
}

function shorten(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function stateLabel(status: BranchTreeStateView['status']): string {
  switch (status) {
    case 'scored': return 'Scored';
    case 'conceded': return 'Given up';
    case 'needs-attention': return 'Needs a plan';
    case 'authoring': return 'In progress';
    case 'continued': return 'Continued';
  }
}

function blockContains(block: BranchTreeBlockView, branchId: string): boolean {
  return block.states.some(state =>
    state.id === branchId || (state.nextBlock ? blockContains(state.nextBlock, branchId) : false));
}

/** The completed run using the same block → state → block model as the live tree. */
export function BranchTreeGraphic({ tree, highlightedBranchId }: Props) {
  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];
  const blockNumbersByColumn = new Map<number, Set<number>>();
  let leafIndex = 0;
  let maxColumn = 0;
  let maxBlockNumber = 0;

  const xFor = (column: number) => {
    maxColumn = Math.max(maxColumn, column);
    return MARGIN + NODE_WIDTH / 2 + column * (NODE_WIDTH + COLUMN_GAP);
  };

  const visitState = (
    state: BranchTreeStateView,
    column: number,
    key: string,
    parent?: LayoutNode,
  ): LayoutNode => {
    const highlighted = highlightedBranchId !== undefined
      && (state.id === highlightedBranchId
        || (state.nextBlock ? blockContains(state.nextBlock, highlightedBranchId) : false));
    const node: LayoutNode = {
      key,
      x: xFor(column),
      y: 0,
      title: `${state.number} — ${state.label}`,
      detail: `${stateLabel(state.status)} · ${pct(state.weight)}`,
      description: `Universe ${state.number}: ${state.path}; ${stateLabel(state.status)}; ${pct(state.weight)} chance`,
      kind: state.status,
      highlighted,
      selected: state.id === highlightedBranchId,
    };
    nodes.push(node);
    if (parent) edges.push({ from: parent, to: node });

    if (state.nextBlock) {
      const children = visitBlock(state.nextBlock, column + 1, `${key}/block`, node);
      node.y = children.length > 0
        ? children.reduce((total, child) => total + child.y, 0) / children.length
        : MARGIN + COLUMN_HEADER_HEIGHT + NODE_HEIGHT / 2 + leafIndex++ * ROW_GAP;
    } else {
      node.y = MARGIN + COLUMN_HEADER_HEIGHT + NODE_HEIGHT / 2 + leafIndex++ * ROW_GAP;
    }
    return node;
  };

  const visitBlock = (
    block: BranchTreeBlockView,
    column: number,
    key: string,
    parent?: LayoutNode,
  ): LayoutNode[] => {
    maxBlockNumber = Math.max(maxBlockNumber, block.blockNumber);
    xFor(column);
    const blockNumbers = blockNumbersByColumn.get(column) ?? new Set<number>();
    blockNumbers.add(block.blockNumber);
    blockNumbersByColumn.set(column, blockNumbers);
    return block.states.map((state, index) =>
      visitState(state, column, `${key}/state-${index}-${state.id}`, parent));
  };

  visitBlock(tree, 0, `block-${tree.id}`);

  const width = MARGIN * 2 + (maxColumn + 1) * NODE_WIDTH + maxColumn * COLUMN_GAP;
  const height = MARGIN * 2 + COLUMN_HEADER_HEIGHT + NODE_HEIGHT + Math.max(0, leafIndex - 1) * ROW_GAP;
  const columns = [...blockNumbersByColumn.entries()].sort(([left], [right]) => left - right);

  return (
    <figure className="branch-tree">
      <div className="branch-tree__heading">Game branches</div>
      <div className="branch-tree__scroll">
        <svg
          className="branch-tree__svg"
          style={{ minWidth: `${width}px` }}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Game branch tree with ${maxBlockNumber} ${maxBlockNumber === 1 ? 'block' : 'blocks'} and ${leafIndex} ending ${leafIndex === 1 ? 'universe' : 'universes'}${highlightedBranchId ? '; reviewed branch highlighted' : ''}`}
        >
          <g className="branch-tree__columns" aria-hidden="true">
            {columns.map(([column, blockNumbers]) => {
              const numbers = [...blockNumbers].sort((left, right) => left - right);
              const label = `${numbers.length === 1 ? 'Block' : 'Blocks'} ${numbers.join(', ')}`;
              const x = MARGIN + NODE_WIDTH / 2 + column * (NODE_WIDTH + COLUMN_GAP);
              const dividerX = x - NODE_WIDTH / 2 - COLUMN_GAP / 2;
              return (
                <g key={column}>
                  {column > 0 && (
                    <line
                      className="branch-tree__column-divider"
                      x1={dividerX}
                      y1={MARGIN + COLUMN_HEADER_HEIGHT - 5}
                      x2={dividerX}
                      y2={height - MARGIN}
                    />
                  )}
                  <text className="branch-tree__column-label" x={x} y={MARGIN + 11} textAnchor="middle">
                    {label}
                  </text>
                </g>
              );
            })}
          </g>
          <g className="branch-tree__edges" aria-hidden="true">
            {edges.map(edge => {
              const startX = edge.from.x + NODE_WIDTH / 2;
              const endX = edge.to.x - NODE_WIDTH / 2;
              const middleX = (startX + endX) / 2;
              return (
                <path
                  key={`${edge.from.key}-${edge.to.key}`}
                  className={edge.from.highlighted && edge.to.highlighted ? 'branch-tree__edge--highlighted' : undefined}
                  d={`M ${startX} ${edge.from.y} C ${middleX} ${edge.from.y}, ${middleX} ${edge.to.y}, ${endX} ${edge.to.y}`}
                />
              );
            })}
          </g>
          <g className="branch-tree__nodes">
            {nodes.map(node => (
              <g
                key={node.key}
                className={[
                  'branch-tree__node',
                  `branch-tree__node--${node.kind}`,
                  node.highlighted ? 'branch-tree__node--highlighted' : '',
                  node.selected ? 'branch-tree__node--selected' : '',
                ].filter(Boolean).join(' ')}
                transform={`translate(${node.x - NODE_WIDTH / 2} ${node.y - NODE_HEIGHT / 2})`}
              >
                <title>{node.description}</title>
                <rect width={NODE_WIDTH} height={NODE_HEIGHT} rx="7" />
                <text className="branch-tree__node-title" x="10" y="20">{shorten(node.title, 24)}</text>
                <text className="branch-tree__node-detail" x="10" y="39">{node.detail}</text>
              </g>
            ))}
          </g>
        </svg>
      </div>
      <figcaption>Each column is one block; lines follow the resulting universes from left to right.</figcaption>
    </figure>
  );
}
