import type { BranchSummary } from './blockBranchTree';
import type { BranchRun, BranchStripEntry, RunLine } from './branchRun';
import './BranchTreeGraphic.css';

const NODE_WIDTH = 174;
const NODE_HEIGHT = 52;
const COLUMN_GAP = 72;
const ROW_GAP = 72;
const MARGIN = 18;

interface Props {
  run: BranchRun;
  summary: BranchSummary;
  branches: BranchStripEntry[];
}

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  title: string;
  detail: string;
  description: string;
  kind: 'block' | BranchStripEntry['status'];
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

function terminalLabel(status: BranchStripEntry['status']): string {
  switch (status) {
    case 'scored': return 'Scored';
    case 'conceded': return 'Given up';
    case 'needs-attention': return 'Needs a plan';
    case 'authoring': return 'In progress';
  }
}

/**
 * The actual block tree, laid out one block-depth per column. Internal nodes
 * name the block that forks the run; leaves show how that universe ended.
 */
export function BranchTreeGraphic({ run, summary, branches }: Props) {
  const weights = new Map(summary.lines.map(line => [line.id, line.weight]));
  const leaves = new Map(branches.map(branch => [branch.id, branch]));
  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];
  let leafIndex = 0;
  let maxDepth = 0;
  let blockCount = 0;

  const visit = (line: RunLine, depth: number, parent?: LayoutNode): LayoutNode => {
    maxDepth = Math.max(maxDepth, depth);
    const childLines = line.split?.childIds
      .map(id => run.lines[id])
      .filter((child): child is RunLine => child !== undefined) ?? [];
    const childNodes: LayoutNode[] = [];
    const y = childLines.length === 0
      ? MARGIN + NODE_HEIGHT / 2 + leafIndex++ * ROW_GAP
      : 0;

    const branch = leaves.get(line.id);
    const blockNumber = depth + 1;
    const isBlock = line.split !== null;
    if (isBlock) blockCount = Math.max(blockCount, blockNumber);
    const title = line.parentId === null
      ? `Block ${blockNumber}`
      : line.label;
    const detail = line.split
      ? line.parentId === null
        ? shorten(`${line.split.attackerName} ⚔ ${line.split.defenderName}`, 29)
        : `Block ${blockNumber} · ${shorten(`${line.split.attackerName} ⚔ ${line.split.defenderName}`, 20)}`
      : `${terminalLabel(branch?.status ?? 'authoring')} · ${pct(weights.get(line.id) ?? 0)}`;
    const description = line.split
      ? `${line.parentId === null ? '' : `${line.label}; `}Block ${blockNumber}: ${line.split.attackerName} versus ${line.split.defenderName}`
      : `${branch?.path ?? line.label}; ${terminalLabel(branch?.status ?? 'authoring')}; ${pct(weights.get(line.id) ?? 0)} chance`;

    const node: LayoutNode = {
      id: line.id,
      x: MARGIN + NODE_WIDTH / 2 + depth * (NODE_WIDTH + COLUMN_GAP),
      y,
      title,
      detail,
      description,
      kind: isBlock ? 'block' : branch?.status ?? 'authoring',
    };

    for (const child of childLines) childNodes.push(visit(child, depth + 1, node));
    if (childNodes.length > 0) {
      node.y = childNodes.reduce((total, child) => total + child.y, 0) / childNodes.length;
    }
    nodes.push(node);
    if (parent) edges.push({ from: parent, to: node });
    return node;
  };

  visit(run.lines[run.rootId], 0);

  const width = MARGIN * 2 + (maxDepth + 1) * NODE_WIDTH + maxDepth * COLUMN_GAP;
  const height = MARGIN * 2 + NODE_HEIGHT + Math.max(0, leafIndex - 1) * ROW_GAP;
  const endingUniverses = branches.length;

  return (
    <figure className="branch-tree">
      <div className="branch-tree__heading">Game branches</div>
      <div className="branch-tree__scroll">
        <svg
          className="branch-tree__svg"
          style={{ minWidth: `${width}px` }}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Game branch tree with ${blockCount} ${blockCount === 1 ? 'block' : 'blocks'} and ${endingUniverses} ending ${endingUniverses === 1 ? 'universe' : 'universes'}`}
        >
          <g className="branch-tree__edges" aria-hidden="true">
            {edges.map(edge => {
              const startX = edge.from.x + NODE_WIDTH / 2;
              const endX = edge.to.x - NODE_WIDTH / 2;
              const middleX = (startX + endX) / 2;
              return (
                <path
                  key={`${edge.from.id}-${edge.to.id}`}
                  d={`M ${startX} ${edge.from.y} C ${middleX} ${edge.from.y}, ${middleX} ${edge.to.y}, ${endX} ${edge.to.y}`}
                />
              );
            })}
          </g>
          <g className="branch-tree__nodes">
            {nodes.map(node => (
              <g
                key={node.id}
                className={`branch-tree__node branch-tree__node--${node.kind}`}
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
      <figcaption>Blocks progress from left to right; each line follows one resulting universe.</figcaption>
    </figure>
  );
}
