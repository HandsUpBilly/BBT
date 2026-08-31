import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminConsole } from './AdminConsole';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const emptyRankings = {
  totalEntries: 0,
  series: [{ id: 'default', name: 'Tutorial', count: 0 }],
  puzzles: [{ id: 'scenario-001', name: 'Opening Drive', count: 0 }],
};

describe('AdminConsole', () => {
  it('adds, confirms removal, and renders managed access history', async () => {
    const responses = [
      { managedAdmins: ['coach@example.com'], configuredAdminCount: 1, audit: [] },
      { managedAdmins: ['coach@example.com', 'assistant@example.com'], configuredAdminCount: 1, audit: [{ action: 'added', actor: 'coach@example.com', target: 'assistant@example.com', at: '2026-08-19T12:00:00.000Z' }] },
      { managedAdmins: ['coach@example.com'], configuredAdminCount: 1, audit: [{ action: 'removed', actor: 'coach@example.com', target: 'assistant@example.com', at: '2026-08-19T12:01:00.000Z' }] },
    ];
    const fetchMock = vi.fn().mockImplementation((url: string) => Promise.resolve({
      ok: true,
      json: async () => url === '/api/editor/profiles'
        ? []
        : url === '/api/editor/rankings' ? emptyRankings : responses.shift(),
    }));
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

  it('lists public profiles and removes an unsuitable avatar', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/editor/profiles?userId=user-1' && options?.method === 'DELETE') {
        return Promise.resolve({ ok: true, json: async () => ({ userId: 'user-1', country: 'Wales', hasAvatar: false, updatedAt: '2026-08-31T12:00:00.000Z' }) });
      }
      if (url === '/api/editor/profiles') {
        return Promise.resolve({ ok: true, json: async () => [{ userId: 'user-1', country: 'Wales', avatarVersion: 'v1', hasAvatar: true, updatedAt: 'v1' }] });
      }
      if (url === '/api/editor/rankings') {
        return Promise.resolve({ ok: true, json: async () => emptyRankings });
      }
      return Promise.resolve({ ok: true, json: async () => ({ managedAdmins: [], configuredAdminCount: 1, audit: [] }) });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<AdminConsole idToken="admin-token" onBack={() => undefined} />);

    expect(await screen.findByText('Wales')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove avatar' }));
    const removeButtons = screen.getAllByRole('button', { name: 'Remove avatar' });
    fireEvent.click(removeButtons[removeButtons.length - 1]);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/editor/profiles?userId=user-1', {
      method: 'DELETE', headers: { Authorization: 'Bearer admin-token' },
    }));
  });

  it('clears one puzzle, one series, or every ranking only after confirmation', async () => {
    const populated = {
      totalEntries: 6,
      series: [{ id: 'default', name: 'Tutorial', count: 2 }],
      puzzles: [{ id: 'scenario-001', name: 'Opening Drive', count: 4 }],
    };
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.startsWith('/api/editor/rankings?') && options?.method === 'DELETE') {
        return Promise.resolve({ ok: true, json: async () => ({ removed: 4, summary: populated }) });
      }
      if (url === '/api/editor/rankings') {
        return Promise.resolve({ ok: true, json: async () => populated });
      }
      if (url === '/api/editor/profiles') {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.resolve({ ok: true, json: async () => ({ managedAdmins: [], configuredAdminCount: 1, audit: [] }) });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<AdminConsole idToken="admin-token" onBack={() => undefined} />);

    expect(await screen.findByText('6 retained ranking entries in total')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear Opening Drive puzzle rankings' }));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('scope=puzzle'), expect.anything());
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Clear puzzle rankings' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/editor/rankings?scope=puzzle&id=scenario-001',
      { method: 'DELETE', headers: { Authorization: 'Bearer admin-token' } },
    ));
    expect(await screen.findByText(/4 ranking entries cleared/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Clear Tutorial series rankings' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Clear series rankings' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/editor/rankings?scope=series&id=default',
      { method: 'DELETE', headers: { Authorization: 'Bearer admin-token' } },
    ));

    fireEvent.click(screen.getByRole('button', { name: 'Clear all rankings' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Clear all rankings' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/editor/rankings?scope=all',
      { method: 'DELETE', headers: { Authorization: 'Bearer admin-token' } },
    ));
  });
});
