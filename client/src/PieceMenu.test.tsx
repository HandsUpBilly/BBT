import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PieceMenu, DEFAULT_ACTIONS } from './PieceMenu';
import { humanBlocker } from './test/gameState';

afterEach(cleanup);

describe('PieceMenu', () => {
  it('shows every player stat alongside the action choices', () => {
    const piece = humanBlocker({ ma: 6, st: 3, ag: 3, pa: 4, av: 9 });
    render(
      <PieceMenu
        piece={piece}
        anchor={{ top: 10, left: 10, right: 110, bottom: 60 }}
        actions={DEFAULT_ACTIONS}
        onAction={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    const stats = screen.getByLabelText(`${piece.name} stats`);
    expect(within(stats).getByText('MA').parentElement?.textContent).toContain('6');
    expect(within(stats).getByText('ST').parentElement?.textContent).toContain('3');
    expect(within(stats).getByText('AG').parentElement?.textContent).toContain('3+');
    expect(within(stats).getByText('PA').parentElement?.textContent).toContain('4+');
    expect(within(stats).getByText('AV').parentElement?.textContent).toContain('9+');
    expect(screen.getAllByRole('checkbox')).toHaveLength(5);
  });

  it('keeps actions from later Tutorial drills disabled', () => {
    const piece = humanBlocker();
    render(
      <PieceMenu
        piece={piece}
        anchor={{ top: 10, left: 10, right: 110, bottom: 60 }}
        actions={DEFAULT_ACTIONS.map(action => ({
          ...action,
          disabled: ['handoff', 'pass', 'block', 'blitz'].includes(action.key),
        }))}
        onAction={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect((screen.getByRole('checkbox', { name: 'Move' }) as HTMLInputElement).disabled).toBe(false);
    for (const action of ['Hand-off', 'Pass', 'Block', 'Blitz']) {
      expect((screen.getByRole('checkbox', { name: action }) as HTMLInputElement).disabled).toBe(true);
    }
  });
});
