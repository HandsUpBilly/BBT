import type { BranchTreeBlockView, BranchTreeStateView } from './branchRun';

export interface BranchTreeStatePlacement {
  state: BranchTreeStateView;
  startColumn: number;
  columnSpan: number;
}

export interface BranchTreeBlockPlacement {
  block: BranchTreeBlockView;
  startColumn: number;
  columnSpan: number;
  states: BranchTreeStatePlacement[];
}

export interface BranchTreeStripLayout {
  blockNumber: number;
  blocks: BranchTreeBlockPlacement[];
}

export interface BranchTreeStripGrid {
  leafColumns: number;
  strips: BranchTreeStripLayout[];
}

/** True when a block contains the selected leaf anywhere below it. */
export function branchTreeContains(block: BranchTreeBlockView, branchId: string): boolean {
  return block.states.some(state =>
    state.id === branchId || (state.nextBlock ? branchTreeContains(state.nextBlock, branchId) : false));
}

/**
 * Lay a tree onto horizontal strips.
 *
 * Every ending universe owns one column. A parent state spans all columns used
 * by its descendants, which puts a later block directly beneath the state that
 * produced it while keeping every block depth on one horizontal line.
 */
export function branchTreeStripGrid(
  tree: BranchTreeBlockView,
  includeLeaf: (state: BranchTreeStateView) => boolean = () => true,
): BranchTreeStripGrid {
  const strips: BranchTreeStripLayout[] = [];

  const stateColumns = (state: BranchTreeStateView): number => {
    if (!state.nextBlock) return includeLeaf(state) ? 1 : 0;
    return state.nextBlock.states.reduce((total, child) => total + stateColumns(child), 0);
  };

  const placeBlock = (block: BranchTreeBlockView, depth: number, startColumn: number): number => {
    const states: BranchTreeStatePlacement[] = [];
    let cursor = startColumn;

    for (const state of block.states) {
      const columnSpan = stateColumns(state);
      if (columnSpan === 0) continue;
      states.push({ state, startColumn: cursor, columnSpan });
      if (state.nextBlock) placeBlock(state.nextBlock, depth + 1, cursor);
      cursor += columnSpan;
    }

    const columnSpan = cursor - startColumn;
    if (columnSpan > 0) {
      const strip = strips[depth] ?? { blockNumber: depth + 1, blocks: [] };
      strip.blocks.push({ block, startColumn, columnSpan, states });
      strips[depth] = strip;
    }
    return columnSpan;
  };

  const leafColumns = placeBlock(tree, 0, 0);
  return { leafColumns, strips };
}
