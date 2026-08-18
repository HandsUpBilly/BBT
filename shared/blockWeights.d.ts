export declare const DIE_FACES: 6;

export type BlockDiceCount = 1 | 2 | 3;
export type BlockResultPicker = 'attacker' | 'defender';

export interface BlockStateWeights {
  probabilities: number[];
  deadProbability: number;
  order: number[];
}

export declare function blockStateWeights(
  faceCounts: readonly number[],
  deadFaceCount: number,
  values: readonly number[],
  diceCount: BlockDiceCount,
  picker: BlockResultPicker,
): BlockStateWeights;

export declare function blockNodeWeightedValue(
  faceCounts: readonly number[],
  deadFaceCount: number,
  values: readonly number[],
  diceCount: BlockDiceCount,
  picker: BlockResultPicker,
): number;
