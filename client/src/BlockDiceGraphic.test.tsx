import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BlockDiceGraphic, BlockFaceGraphic } from './BlockDiceGraphic';

describe('BlockDiceGraphic', () => {
  it('draws one icon per die and records who picks', () => {
    const { container } = render(<BlockDiceGraphic count={2} favor="defender" />);
    const graphic = container.querySelector('.block-dice-graphic');

    expect(graphic?.querySelectorAll('.block-die-icon')).toHaveLength(2);
    expect(graphic?.getAttribute('data-favor')).toBe('defender');
    expect(graphic?.getAttribute('title')).toContain('defender picks');
  });

  it('labels the attacker-picks case as the player picking', () => {
    const { container } = render(<BlockDiceGraphic count={1} favor="attacker" />);
    expect(container.querySelector('.block-dice-graphic')?.getAttribute('title')).toContain('you pick');
  });
});

describe('BlockFaceGraphic', () => {
  it('defaults to a single die when no count is given', () => {
    const { container } = render(<BlockFaceGraphic face="push" />);
    expect(container.querySelectorAll('.block-die-icon')).toHaveLength(1);
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
