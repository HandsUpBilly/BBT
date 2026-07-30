import type { BlockOutcomeFace } from './types';

const VIEWPORT_GAP = 8;

export function clampMenuPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  return {
    left: Math.max(VIEWPORT_GAP, Math.min(x + 4, viewportWidth - width - VIEWPORT_GAP)),
    top: Math.max(VIEWPORT_GAP, Math.min(y + 4, viewportHeight - height - VIEWPORT_GAP)),
  };
}

export function isBlockOutcomeSelectable(face: BlockOutcomeFace, attackerSkills: string[]) {
  if (face === 'attacker-down') return false;
  if (face === 'both-down') {
    return attackerSkills.includes('Block') || attackerSkills.includes('Wrestle');
  }
  return true;
}
