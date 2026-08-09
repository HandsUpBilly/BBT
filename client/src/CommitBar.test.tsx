import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommitBar } from './CommitBar';

describe('CommitBar', () => {
  it('keeps a non-interactive placeholder mounted while no move is armed', () => {
    const { container } = render(
      <CommitBar
        destination={null}
        probability={100}
        showProbability={false}
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    );
    const bar = container.firstElementChild;

    expect(bar?.classList.contains('commit-bar--placeholder')).toBe(true);
    expect(bar?.getAttribute('aria-hidden')).toBe('true');
    expect((screen.getByRole('button', { name: 'Cancel', hidden: true }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Confirm', hidden: true }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('uses the same structure for an armed move and exposes its actions', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const { container } = render(
      <CommitBar
        destination={{ col: 7, row: 12 }}
        probability={42}
        showProbability
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    expect(container.firstElementChild?.classList.contains('commit-bar--placeholder')).toBe(false);
    expect(screen.getByText('Move to 12H')).toBeTruthy();
    expect(screen.getByText('42% success').classList.contains('commit-bar__prob--risky')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
