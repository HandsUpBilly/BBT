import type { BlockOutcomeFace } from './types';
import whiteAttackerDownDie from './assets/block-dice/white/attacker-down.png';
import whiteBothDownDie from './assets/block-dice/white/both-down.png';
import whitePushDie from './assets/block-dice/white/push.png';
import whiteDefenderStumblesDie from './assets/block-dice/white/defender-stumbles.png';
import whiteDefenderDownDie from './assets/block-dice/white/defender-down.png';
import redAttackerDownDie from './assets/block-dice/red/attacker-down.png';
import redBothDownDie from './assets/block-dice/red/both-down.png';
import redPushDie from './assets/block-dice/red/push.png';
import redDefenderStumblesDie from './assets/block-dice/red/defender-stumbles.png';
import redDefenderDownDie from './assets/block-dice/red/defender-down.png';

export type BlockDiceFavor = 'attacker' | 'defender';

export const BLOCK_FACE_IMAGES: Record<BlockDiceFavor, Record<BlockOutcomeFace, string>> = {
  attacker: {
    'attacker-down': whiteAttackerDownDie,
    'both-down': whiteBothDownDie,
    push: whitePushDie,
    'defender-stumbles': whiteDefenderStumblesDie,
    'defender-down': whiteDefenderDownDie,
  },
  defender: {
    'attacker-down': redAttackerDownDie,
    'both-down': redBothDownDie,
    push: redPushDie,
    'defender-stumbles': redDefenderStumblesDie,
    'defender-down': redDefenderDownDie,
  },
};

/** Source artwork for compact SVG summaries such as the branch playbook. */
export function blockFaceImage(face: BlockOutcomeFace, favor: BlockDiceFavor = 'attacker'): string {
  return BLOCK_FACE_IMAGES[favor][face];
}
