import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SuccessChanceReadout } from './SuccessChanceReadout';

describe('SuccessChanceReadout', () => {
  it('keeps an invisible 100% placeholder mounted before a roll is involved', () => {
    const { container } = render(<SuccessChanceReadout probability={100} visible={false} />);
    const readout = container.firstElementChild;

    expect(screen.getByText('Success chance')).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();
    expect(readout?.classList.contains('hud__success--placeholder')).toBe(true);
    expect(readout?.getAttribute('aria-hidden')).toBe('true');
  });

  it('reveals the same slot for a risky probability', () => {
    const { container } = render(<SuccessChanceReadout probability={42} visible />);
    const readout = container.firstElementChild;

    expect(screen.getByText('42%').classList.contains('hud__prob-value--risky')).toBe(true);
    expect(readout?.classList.contains('hud__success--placeholder')).toBe(false);
    expect(readout?.getAttribute('aria-hidden')).toBe('false');
  });
});
