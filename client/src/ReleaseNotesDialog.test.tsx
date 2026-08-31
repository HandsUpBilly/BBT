import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReleaseNotesDialog } from './ReleaseNotesDialog';
import type { ReleaseNote } from './releaseNotes';

afterEach(cleanup);

const NOTES: ReleaseNote[] = [
  {
    date: '2026-08-31',
    title: 'Release Notes — August 31, 2026',
    summary: 'A quiet week.',
    categories: [{ name: 'New', items: ['Added release notes.'] }],
  },
  {
    date: '2026-08-24',
    title: 'Release Notes — August 24, 2026',
    categories: [{ name: 'Fixed', items: ['Squashed a bug.'] }],
  },
];

describe('ReleaseNotesDialog', () => {
  it('shows the newest week first, with Newer disabled and Older enabled', () => {
    render(<ReleaseNotesDialog notes={NOTES} onClose={vi.fn()} />);

    expect(screen.getByText('Release Notes — August 31, 2026')).toBeTruthy();
    expect(screen.getByText('A quiet week.')).toBeTruthy();
    expect(screen.getByText('1 of 2')).toBeTruthy();
    expect((screen.getByRole('button', { name: '← Newer' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Older →' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('clicks through to older and back to newer weeks', () => {
    render(<ReleaseNotesDialog notes={NOTES} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Older →' }));
    expect(screen.getByText('Release Notes — August 24, 2026')).toBeTruthy();
    expect(screen.getByText('Squashed a bug.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Older →' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: '← Newer' }));
    expect(screen.getByText('Release Notes — August 31, 2026')).toBeTruthy();
  });

  it('shows an empty state when there are no notes yet', () => {
    render(<ReleaseNotesDialog notes={[]} onClose={vi.fn()} />);
    expect(screen.getByText('No release notes yet — check back soon.')).toBeTruthy();
  });

  it('closes from its button and on Escape', () => {
    const onClose = vi.fn();
    render(<ReleaseNotesDialog notes={NOTES} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
