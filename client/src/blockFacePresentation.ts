import type { BlockOutcomeFace } from './types';

// Shared by the generated block-die artwork and the possible-outcome rows so
// the same block result reads identically everywhere it appears.
export const BLOCK_FACE_LABELS: Record<BlockOutcomeFace, string> = {
  'attacker-down': 'Attacker Down',
  'both-down': 'Both Down',
  'push': 'Push Back',
  'defender-stumbles': 'Defender Stumbles',
  'defender-down': 'Defender Down',
};
