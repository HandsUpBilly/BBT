import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HelpScreen } from './HelpScreen';

afterEach(cleanup);

describe('HelpScreen', () => {
  it('explains the one-turn rules and the shared action confirmation', () => {
    render(<HelpScreen onBack={() => undefined} />);

    expect(screen.getByRole('heading', { name: 'Find the strongest sequence' })).toBeTruthy();
    expect(screen.getByText(/highest probability of meeting the puzzle's stated objective/i)).toBeTruthy();
    expect(screen.getByText(/successful foul, a crowd surf/i)).toBeTruthy();
    const decisionPicture = screen.getByRole('img', { name: /plotted movement route/i });
    expect(decisionPicture).toBeTruthy();
    const routeMarker = decisionPicture.querySelector('#help-route-arrow');
    expect(routeMarker?.getAttribute('viewBox')).toBe('0 0 8 8');
    expect(routeMarker?.getAttribute('markerUnits')).toBe('userSpaceOnUse');
    expect(routeMarker?.getAttribute('markerWidth')).toBe('18');
    expect(routeMarker?.getAttribute('markerHeight')).toBe('18');
    expect(screen.getByText(/Movement, passes, and hand-offs wait for the green control/)).toBeTruthy();
  });

  it('has an illustrated Parallel Universes page covering strips and lockstep', () => {
    render(<HelpScreen onBack={() => undefined} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Parallel Universes' }));

    expect(screen.getByRole('heading', { name: 'Parallel Universes' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Branch strips' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Lockstep' })).toBeTruthy();
    expect(screen.getByRole('img', { name: /splitting one root play/i })).toBeTruthy();
    expect(screen.getByRole('img', { name: /three universe cards/i })).toBeTruthy();
    expect(screen.getByRole('img', { name: /same safe movement copied/i })).toBeTruthy();
    expect(screen.getAllByText(/1\.1, 1\.2/)).toHaveLength(2);
  });

  it('returns to the screen that opened it', () => {
    const onBack = vi.fn();
    render(<HelpScreen onBack={onBack} />);

    fireEvent.click(screen.getByRole('button', { name: '← Back' }));

    expect(onBack).toHaveBeenCalledOnce();
  });
});
