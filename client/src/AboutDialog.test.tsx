import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AboutDialog } from './AboutDialog';

afterEach(cleanup);

describe('AboutDialog', () => {
  it('shows the build version and closes from its button', () => {
    const onClose = vi.fn();
    render(<AboutDialog version="abc123" onClose={onClose} />);

    expect(screen.getByRole('dialog', { name: 'About Turn 16' })).toBeTruthy();
    expect(screen.getByText('Version abc123')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<AboutDialog version="abc123" onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('restores focus to its launcher after closing', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open About</button>
          {open && <AboutDialog version="abc123" onClose={() => setOpen(false)} />}
        </>
      );
    }

    render(<Harness />);
    const launcher = screen.getByRole('button', { name: 'Open About' });
    launcher.focus();
    fireEvent.click(launcher);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(document.activeElement).toBe(launcher);
  });
});
