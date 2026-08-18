import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BlockDiceGraphic, BlockFaceGraphic } from './BlockDiceGraphic';

describe('BlockDiceGraphic', () => {
  it('draws one animated icon per die with every possible face', () => {
    const { container } = render(<BlockDiceGraphic count={2} favor="defender" />);
    const graphic = container.querySelector('.block-dice-graphic');

    expect(graphic?.querySelectorAll('.block-die-icon')).toHaveLength(2);
    expect(graphic?.querySelectorAll('.block-die-icon__face')).toHaveLength(10);
    expect(graphic?.querySelectorAll('img')).toHaveLength(10);
    expect(graphic?.getAttribute('data-favor')).toBe('defender');
    expect(graphic?.getAttribute('data-rolling')).toBe('true');
    expect(graphic?.getAttribute('title')).toContain('possible outcomes');

    graphic?.querySelectorAll<HTMLElement>('.block-die-icon').forEach(die => {
      expect(die.style.getPropertyValue('--die-roll-duration')).toMatch(/^\d+\.\d{2}s$/);
      expect(die.style.getPropertyValue('--die-x-start')).toMatch(/^-?\d+\.\dpx$/);
      expect(die.style.getPropertyValue('--die-spin-impact')).toMatch(/^-?\d+\.\ddeg$/);
    });
  });

  it('does not describe either side as picking in its player-facing label', () => {
    const { container } = render(<BlockDiceGraphic count={1} favor="attacker" />);
    expect(container.querySelector('.block-dice-graphic')?.getAttribute('title')).not.toContain('pick');
  });
});

describe('BlockFaceGraphic', () => {
  it('defaults to a single die when no count is given', () => {
    const { container } = render(<BlockFaceGraphic face="push" />);
    expect(container.querySelectorAll('.block-die-icon')).toHaveLength(1);
    expect(container.querySelector('img')?.getAttribute('src')).toContain('push');
  });

  it('repeats the resolved face once per die actually rolled', () => {
    // This is the fix: a 2-dice block used to show one die on the pitch
    // regardless of how many were rolled.
    const { container } = render(<BlockFaceGraphic face="defender-down" count={2} favor="defender" />);

    expect(container.querySelectorAll('.block-die-icon')).toHaveLength(2);
    expect(container.querySelector('.block-dice-graphic')?.getAttribute('data-favor')).toBe('defender');
  });

  it('colours the marker white/neutral when the attacker picked', () => {
    const { container } = render(<BlockFaceGraphic face="push" count={2} favor="attacker" />);
    expect(container.querySelector('.block-dice-graphic')?.getAttribute('data-favor')).toBe('attacker');
  });
});
