import type { KeyboardEvent } from 'react';
import type { BranchTreeBlockView, BranchTreeStateView } from './branchRun';
import { BLOCK_FACE_LABELS } from './blockDiceAssets';
import './BranchTreeGraphic.css';

const NODE_WIDTH = 174;
const NODE_HEIGHT = 58;
const COLUMN_GAP = 48;
const ROW_GAP = 76;
const MARGIN = 18;
const COLUMN_HEADER_HEIGHT = 30;

interface Props {
  tree: BranchTreeBlockView;
  highlightedBranchId?: string;
  onSelectBranches?: (branchIds: string[]) => void;
}

interface LayoutNode {
  key: string; x: number; y: number; title: string; detail: string; description: string;
  kind: BranchTreeStateView['status']; highlighted: boolean; selected: boolean; merged: boolean;
  selectableIds: string[]; selectLabel: string; children: LayoutNode[];
}
interface PendingState { state: BranchTreeStateView; parents: LayoutNode[]; }

function pct(value: number): string {
  return value > 0 && value < 0.005 ? '<1%' : `${Math.round(value * 100)}%`;
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
  return block.states.some(state => state.id === branchId || (state.nextBlock ? blockContains(state.nextBlock, branchId) : false));
}
function endingUniverses(state: BranchTreeStateView): string[] {
  if (state.isSelectable) return [state.id];
  return (state.nextBlock?.states ?? []).flatMap(endingUniverses);
}

function diceRolls(states: readonly BranchTreeStateView[]): string {
  const faces = [...new Set(states.flatMap(state => state.outcomes[state.outcomes.length - 1]?.faces ?? []))];
  return faces.map(face => BLOCK_FACE_LABELS[face]).join(', ');
}

/** A completed-run DAG which collapses outcomes that stayed in lockstep. */
export function BranchTreeGraphic({ tree, highlightedBranchId, onSelectBranches }: Props) {
  const nodes: LayoutNode[] = [];
  const edges = new Set<string>();
  const blockNumbersByColumn = new Map<number, Set<number>>();
  const layers: LayoutNode[][] = [];
  let maxBlockNumber = 0;

  const addLayer = (blocks: Array<{ block: BranchTreeBlockView; parents: LayoutNode[] }>, column: number) => {
    if (blocks.length === 0) return;
    const pending = new Map<string, PendingState[]>();
    const blockNumbers = blockNumbersByColumn.get(column) ?? new Set<number>();
    for (const { block, parents } of blocks) {
      maxBlockNumber = Math.max(maxBlockNumber, block.blockNumber);
      blockNumbers.add(block.blockNumber);
      for (const state of block.states) {
        const groupKey = `${block.blockLabel}:${state.lockstepId ?? state.id}`;
        const group = pending.get(groupKey);
        if (group) group.push({ state, parents });
        else pending.set(groupKey, [{ state, parents }]);
      }
    }
    blockNumbersByColumn.set(column, blockNumbers);

    const layer: LayoutNode[] = [];
    const next: Array<{ block: BranchTreeBlockView; parents: LayoutNode[] }> = [];
    for (const [key, members] of pending) {
      const states = members.map(member => member.state);
      const merged = states.length > 1;
      const weight = states.reduce((total, state) => total + state.weight, 0);
      const weightedValue = states.reduce((total, state) => total + state.weight * state.value, 0);
      const status = new Set(states.map(state => state.status)).size === 1 ? states[0].status : 'continued';
      const highlighted = highlightedBranchId !== undefined && states.some(state => state.id === highlightedBranchId || (state.nextBlock ? blockContains(state.nextBlock, highlightedBranchId) : false));
      const selected = highlightedBranchId !== undefined && states.some(state => state.id === highlightedBranchId);
      const selectableIds = [...new Set(states.flatMap(endingUniverses))];
      const rolls = diceRolls(states);
      const value = weight > 0 ? weightedValue / weight : 0;
      const node: LayoutNode = {
        key: `${column}:${key}`, x: MARGIN + NODE_WIDTH / 2 + column * (NODE_WIDTH + COLUMN_GAP), y: 0,
        // Preserve the fact that this is a merge even when its dice labels are long.
        title: merged ? `${shorten(rolls, 14)} — Merged` : rolls,
        detail: merged ? `${states.length} merged · ${pct(weight)} weight · ${pct(value)} score` : `${stateLabel(status)} · ${pct(weight)} · V ${pct(states[0].value)}`,
        description: merged ? `${rolls} merged in lockstep: ${states.length} outcomes, ${pct(weight)} combined chance, ${pct(value)} chance to score from here` : `${rolls}: ${states[0].path}; ${stateLabel(status)}; ${pct(weight)} chance`,
        kind: status, highlighted, selected, merged, selectableIds,
        selectLabel: `View ${merged ? 'merged outcomes' : 'outcome'}: ${rolls}`,
        children: [],
      };
      nodes.push(node); layer.push(node);
      for (const member of members) {
        for (const parent of member.parents) {
          edges.add(`${parent.key}|${node.key}`);
          if (!parent.children.includes(node)) parent.children.push(node);
        }
        if (member.state.nextBlock) next.push({ block: member.state.nextBlock, parents: [node] });
      }
    }
    layers[column] = layer;
    addLayer(next, column + 1);
  };

  addLayer([{ block: tree, parents: [] }], 0);
  const maxColumn = Math.max(0, layers.length - 1);
  const leaves = nodes.filter(node => node.children.length === 0);
  leaves.forEach((node, index) => { node.y = MARGIN + COLUMN_HEADER_HEIGHT + NODE_HEIGHT / 2 + index * ROW_GAP; });
  for (let column = maxColumn - 1; column >= 0; column -= 1) {
    for (const node of layers[column] ?? []) {
      node.y = node.children.length > 0 ? node.children.reduce((total, child) => total + child.y, 0) / node.children.length : MARGIN + COLUMN_HEADER_HEIGHT + NODE_HEIGHT / 2;
    }
  }
  const width = MARGIN * 2 + (maxColumn + 1) * NODE_WIDTH + maxColumn * COLUMN_GAP;
  const height = MARGIN * 2 + COLUMN_HEADER_HEIGHT + NODE_HEIGHT + Math.max(0, leaves.length - 1) * ROW_GAP;
  const columns = [...blockNumbersByColumn.entries()].sort(([left], [right]) => left - right);

  return <figure className="branch-tree">
    <div className="branch-tree__heading">Game branches</div>
    <div className="branch-tree__scroll"><svg className="branch-tree__svg" style={{ width: `${width}px`, height: `${height}px` }} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Game branch tree with ${maxBlockNumber} ${maxBlockNumber === 1 ? 'block' : 'blocks'} and ${leaves.length} distinct ending ${leaves.length === 1 ? 'universe' : 'universes'}${highlightedBranchId ? '; reviewed branch highlighted' : ''}`}>
      <g className="branch-tree__columns" aria-hidden="true">{columns.map(([column, blockNumbers]) => {
        const numbers = [...blockNumbers].sort((left, right) => left - right);
        const x = MARGIN + NODE_WIDTH / 2 + column * (NODE_WIDTH + COLUMN_GAP);
        const dividerX = x - NODE_WIDTH / 2 - COLUMN_GAP / 2;
        return <g key={column}>{column > 0 && <line className="branch-tree__column-divider" x1={dividerX} y1={MARGIN + COLUMN_HEADER_HEIGHT - 5} x2={dividerX} y2={height - MARGIN} />}<text className="branch-tree__column-label" x={x} y={MARGIN + 11} textAnchor="middle">{`${numbers.length === 1 ? 'Block' : 'Blocks'} ${numbers.join(', ')}`}</text></g>;
      })}</g>
      <g className="branch-tree__edges" aria-hidden="true">{[...edges].map(edgeKey => {
        const [fromKey, toKey] = edgeKey.split('|'); const from = nodes.find(node => node.key === fromKey)!; const to = nodes.find(node => node.key === toKey)!;
        const startX = from.x + NODE_WIDTH / 2; const endX = to.x - NODE_WIDTH / 2; const middleX = (startX + endX) / 2;
        return <path key={edgeKey} className={from.highlighted && to.highlighted ? 'branch-tree__edge--highlighted' : undefined} d={`M ${startX} ${from.y} C ${middleX} ${from.y}, ${middleX} ${to.y}, ${endX} ${to.y}`} />;
      })}</g>
      <g className="branch-tree__nodes">{nodes.map(node => {
        const interactive = node.selectableIds.length > 0 && !!onSelectBranches;
        const select = () => { if (node.selectableIds.length > 0) onSelectBranches?.(node.selectableIds); };
        const onKeyDown = (event: KeyboardEvent<SVGGElement>) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } };
        return <g key={node.key} className={['branch-tree__node', `branch-tree__node--${node.kind}`, node.merged ? 'branch-tree__node--merged' : '', node.highlighted ? 'branch-tree__node--highlighted' : '', node.selected ? 'branch-tree__node--selected' : '', interactive ? 'branch-tree__node--interactive' : ''].filter(Boolean).join(' ')} transform={`translate(${node.x - NODE_WIDTH / 2} ${node.y - NODE_HEIGHT / 2})`} {...(interactive ? { role: 'button', 'aria-label': node.selectLabel, tabIndex: 0, onClick: select, onKeyDown } : {})}><title>{node.description}</title><rect width={NODE_WIDTH} height={NODE_HEIGHT} rx="7" /><text className="branch-tree__node-title" x="10" y="20">{shorten(node.title, 24)}</text><text className="branch-tree__node-detail" x="10" y="42">{shorten(node.detail, 34)}</text></g>;
      })}</g>
    </svg></div>
    <figcaption>Cards combine outcomes that stayed in lockstep; select a card to review every route it represents.</figcaption>
  </figure>;
}
