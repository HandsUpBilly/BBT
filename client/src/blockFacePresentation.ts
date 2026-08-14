import type { BlockOutcomeFace } from './types';

// Shared between BlockDiceGraphic.tsx (the pitch marker and the pre-resolution
// dice-count graphic) and BlockOutcomePanel.tsx (the outcome-choice rows) so
// the same block result reads identically everywhere it appears.
export const BLOCK_FACE_LABELS: Record<BlockOutcomeFace, string> = {
  'attacker-down': 'Attacker Down',
  'both-down': 'Both Down',
  'push': 'Push Back',
  'defender-stumbles': 'Defender Stumbles',
  'defender-down': 'Defender Down',
};

export const BLOCK_FACE_GLYPHS: Record<BlockOutcomeFace, string> = {
  'attacker-down': '☠',
  'both-down': '☠☠',
  'push': '➜',
  'defender-stumbles': '✦',
  'defender-down': '✹',
};
