import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LegendMenu } from './LegendMenu';

// vitest runs without `globals`, so Testing Library's automatic cleanup never
// registers and every render would otherwise stack up in the same document.
afterEach(cleanup);

const closed = { isPassTargeting: false, isBlockTargeting: false, hasPushTargets: false };

describe('LegendMenu', () => {
  it('costs a button and nothing else until it is opened', () => {
    const { container } = render(<LegendMenu {...closed} />);

    expect(screen.getByRole('button', { name: 'Key' })).toBeTruthy();
    expect(container.querySelector('.legend-menu__dropdown')).toBeNull();
    expect(screen.queryByRole('list', { name: 'Pitch state legend' })).toBeNull();
  });

  it('opens the pitch key and both skill keys together', () => {
    render(<LegendMenu {...closed} />);
    fireEvent.click(screen.getByRole('button', { name: 'Key' }));

    const panel = screen.getByRole('dialog', { name: 'Pitch and skill key' });
    expect(within(panel).getByRole('list', { name: 'Pitch state legend' })).toBeTruthy();
    expect(within(panel).getByRole('list', { name: 'Skill group color key' })).toBeTruthy();
    expect(within(panel).getByRole('list', { name: 'Exact skill marker key' })).toBeTruthy();
  });

  it('toggles shut on a second press', () => {
    render(<LegendMenu {...closed} />);
    const trigger = screen.getByRole('button', { name: 'Key' });

    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes on a press outside itself', () => {
    render(<LegendMenu {...closed} />);
    fireEvent.click(screen.getByRole('button', { name: 'Key' }));
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes on Escape without letting the board see it', () => {
    // The window-level Escape in App cancels the planned activation. Closing a
    // reference panel must not also throw the move away.
    let reachedWindow = false;
    const spy = () => { reachedWindow = true; };
    window.addEventListener('keydown', spy);

    render(<LegendMenu {...closed} />);
    fireEvent.click(screen.getByRole('button', { name: 'Key' }));
    fireEvent.keyDown(window, { key: 'Escape' });

    window.removeEventListener('keydown', spy);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(reachedWindow).toBe(false);
  });

  it('shows only the entries that apply while nothing is being aimed', () => {
    render(<LegendMenu {...closed} />);
    fireEvent.click(screen.getByRole('button', { name: 'Key' }));
    const list = screen.getByRole('list', { name: 'Pitch state legend' });

    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
    expect(within(list).queryByText(/Quick Pass/)).toBeNull();
    expect(within(list).queryByText('Block Target')).toBeNull();
  });

  it('gains the pass bands while a throw is being aimed', () => {
    render(<LegendMenu {...closed} isPassTargeting />);
    fireEvent.click(screen.getByRole('button', { name: /^Key,/ }));
    const list = screen.getByRole('list', { name: 'Pitch state legend' });

    expect(within(list).getAllByRole('listitem')).toHaveLength(8);
    expect(within(list).getByText(/Long Bomb/)).toBeTruthy();
  });

  it('counts the contextual entries on the closed button', () => {
    // Behind a button, entries that used to announce themselves by appearing in
    // a visible row would otherwise just be invisible.
    const { rerender } = render(<LegendMenu {...closed} />);
    expect(screen.getByRole('button', { name: 'Key' }).textContent).not.toMatch(/\d/);

    rerender(<LegendMenu {...closed} isPassTargeting isBlockTargeting />);
    const trigger = screen.getByRole('button', { name: 'Key, 5 entries for the current action' });
    expect(trigger.textContent).toContain('5');
  });

  it('counts a pending push-back on its own', () => {
    render(<LegendMenu {...closed} hasPushTargets />);

    expect(screen.getByRole('button', { name: 'Key, 1 entry for the current action' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Key,/ }));
    expect(screen.getByText('Push-Back Square')).toBeTruthy();
  });
});
