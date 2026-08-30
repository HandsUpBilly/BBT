import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AboutDialog } from './AboutDialog';

const DEPLOYED_AT = '2026-08-15T12:34:56.000Z';

afterEach(cleanup);

describe('AboutDialog', () => {
  it('shows the release version and closes from its button', () => {
    const onClose = vi.fn();
    const { container } = render(
      <AboutDialog version="abc123" deployedAt={DEPLOYED_AT} onClose={onClose} />,
    );

    expect(screen.getByRole('dialog', { name: 'About Turn 16' })).toBeTruthy();
    expect(screen.getByText('Version abc123')).toBeTruthy();
    expect(screen.getByText('Last deployed')).toBeTruthy();
    const timestamp = container.querySelector('time');
    expect(timestamp?.dateTime).toBe(DEPLOYED_AT);
    expect(timestamp?.textContent).toContain('2026');

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<AboutDialog version="abc123" deployedAt={DEPLOYED_AT} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('restores focus to its launcher after closing', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open About</button>
          {open && (
            <AboutDialog
              version="abc123"
              deployedAt={DEPLOYED_AT}
              onClose={() => setOpen(false)}
            />
          )}
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
