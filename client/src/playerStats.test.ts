import { describe, expect, it } from 'vitest';
import { agilityTarget, armourTarget, storedAgility, storedArmour, targetLabel } from './playerStats';

describe('player stat display conversions', () => {
  it('restores the printed BB2025 agility and armour targets', () => {
    expect(targetLabel(agilityTarget(3))).toBe('3+');
    expect(targetLabel(agilityTarget(2))).toBe('4+');
    expect(targetLabel(agilityTarget(1))).toBe('5+');
    expect(targetLabel(armourTarget(7))).toBe('8+');
    expect(targetLabel(armourTarget(9))).toBe('10+');
  });

  it('converts edited printed targets back to the engine values', () => {
    expect(storedAgility(4)).toBe(2);
    expect(storedArmour(8)).toBe(7);
  });
});
