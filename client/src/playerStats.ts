/**
 * Converts the values normalized for the rules engine back to the BB2025
 * targets printed on roster cards.
 *
 * `ag` is stored as 6 minus its printed target and `av` as its printed target
 * minus one. See editor/playerTemplates.ts for why the engine uses that form.
 */
export function agilityTarget(ag: number): number {
  return 6 - ag;
}

export function storedAgility(target: number): number {
  return 6 - target;
}

export function armourTarget(av: number): number {
  return av + 1;
}

export function storedArmour(target: number): number {
  return target - 1;
}

export function targetLabel(target: number): string {
  return `${target}+`;
}
