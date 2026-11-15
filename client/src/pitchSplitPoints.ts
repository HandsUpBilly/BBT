import type { BlockOutcomeFace, Position } from './types';
import type { BranchTreeBlockView, BranchTreeStateView } from './branchRun';

/** A dice outcome is a board state, not necessarily one physical die face. */
export interface PitchSplitChoice {
  id: string;
  targetId: string;
  universe: string;
  label: string;
  faces: readonly BlockOutcomeFace[];
  status: BranchTreeStateView['status'];
  isCurrent: boolean;
}

export interface PitchSplitPoint {
  id: string;
  position: Position;
  number: number;
  blockLabel: string;
  diceCount: 1 | 2 | 3;
  picker: 'attacker' | 'defender';
  choices: PitchSplitChoice[];
}

/** Historical states cannot be selected: follow their descendants to a live leaf. */
export function selectSplitDestination(state: BranchTreeStateView): BranchTreeStateView | null {
  if (state.isSelectable) return state;
  if (!state.nextBlock) return null;

  const leaves = state.nextBlock.states
    .map(selectSplitDestination)
    .filter((leaf): leaf is BranchTreeStateView => leaf !== null);
  return leaves.find(leaf => leaf.isViewed)
    ?? leaves.find(leaf => leaf.status !== 'conceded')
    ?? leaves[0]
    ?? null;
}

/**
 * Mark the splits leading to the *viewed* universe, not every split across
 * parallel histories. Each marker lets the player jump to a surviving leaf of
 * every outcome of that block, retaining play authored after the split.
 */
export function pitchSplitPoints(tree: BranchTreeBlockView | null): PitchSplitPoint[] {
  const result: PitchSplitPoint[] = [];
  let block = tree;
  while (block) {
    if (block.position) {
      result.push({
        id: block.id,
        position: block.position,
        number: block.blockNumber,
        blockLabel: block.blockLabel,
        diceCount: block.diceCount,
        picker: block.picker,
        choices: block.states.flatMap(state => {
          const target = selectSplitDestination(state);
          if (!target) return [];
          const outcome = state.outcomes.at(-1);
          return [{
            id: state.id,
            targetId: target.id,
            universe: target.number,
            label: state.label,
            faces: outcome?.faces ?? [],
            status: state.status,
            isCurrent: state.isViewed,
          }];
        }),
      });
    }
    block = block.states.find(state => state.isViewed && state.nextBlock)?.nextBlock ?? null;
  }
  return result;
}
