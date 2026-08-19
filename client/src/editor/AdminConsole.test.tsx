import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminConsole } from './AdminConsole';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('AdminConsole', () => {
  it('adds, confirms removal, and renders managed access history', async () => {
    const responses = [
      { managedAdmins: ['coach@example.com'], configuredAdminCount: 1, audit: [] },
      { managedAdmins: ['coach@example.com', 'assistant@example.com'], configuredAdminCount: 1, audit: [{ action: 'added', actor: 'coach@example.com', target: 'assistant@example.com', at: '2026-08-19T12:00:00.000Z' }] },
      { managedAdmins: ['coach@example.com'], configuredAdminCount: 1, audit: [{ action: 'removed', actor: 'coach@example.com', target: 'assistant@example.com', at: '2026-08-19T12:01:00.000Z' }] },
    ];
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve({ ok: true, json: async () => responses.shift() }));
    vi.stubGlobal('fetch', fetchMock);
    render(<AdminConsole idToken="admin-token" onBack={() => undefined} />);
    expect(await screen.findByText('coach@example.com')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'assistant@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add administrator' }));
    expect(await screen.findByText('assistant@example.com')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[1]);
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
    fireEvent.click(removeButtons[removeButtons.length - 1]);
    await waitFor(() => expect(screen.getByText('coach@example.com removed assistant@example.com')).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith('/api/editor/admins?email=assistant%40example.com', { method: 'DELETE', headers: { Authorization: 'Bearer admin-token' } });
  });
});
