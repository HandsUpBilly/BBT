import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { scenarios } from './scenarios';
import { ReplayGuidanceDialog } from './ReplayGuidanceDialog';

afterEach(cleanup);

describe('ReplayGuidanceDialog', () => {
  it('offers replay with guidance, without guidance, or cancellation', () => {
    const onChoose = vi.fn();
    render(<ReplayGuidanceDialog scenario={scenarios[0]} onChoose={onChoose} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play without guidance' }));
    fireEvent.click(screen.getByRole('button', { name: 'Replay guidance' }));
    expect(onChoose).toHaveBeenNthCalledWith(1, false);
    expect(onChoose).toHaveBeenNthCalledWith(2, true);
  });
});
