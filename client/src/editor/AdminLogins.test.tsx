import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminLogins } from './AdminLogins';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const eligibleLogin = {
  name: 'Coach', firstLoginAt: '2026-08-31T00:00:00.000Z', lastLoginAt: '2026-08-31T00:00:00.000Z',
  loginCount: 1, userId: 'google-1', authProvider: 'google', adminEligible: true, isManagedAdmin: false,
};

describe('AdminLogins', () => {
  it('promotes an eligible login by opaque user id without receiving its email', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/editor/logins') return Promise.resolve({ ok: true, json: async () => [eligibleLogin] });
      if (url === '/api/editor/logins?userId=google-1' && options?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ managedAdmins: ['coach@example.com'], configuredAdminCount: 1, audit: [] }) });
      }
      return Promise.resolve({ ok: false, json: async () => ({ errors: ['Unexpected request'] }) });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminLogins idToken="admin-token" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Promote' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/editor/logins?userId=google-1', {
      method: 'POST', headers: { Authorization: 'Bearer admin-token' },
    }));
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('coach@example.com');
  });

  it('does not offer administration controls for a guest login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [{
      name: 'Guest', firstLoginAt: '2026-08-31T00:00:00.000Z', lastLoginAt: '2026-08-31T00:00:00.000Z',
      loginCount: 1, adminEligible: false, isManagedAdmin: false,
    }] }));

    render(<AdminLogins idToken="admin-token" />);
    expect(await screen.findByRole('rowheader', { name: /Guest/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Promote' })).toBeNull();
  });
});
