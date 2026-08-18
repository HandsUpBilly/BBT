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
        x={10}
        y={10}
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
});
