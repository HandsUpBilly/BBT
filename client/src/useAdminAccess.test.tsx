import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAdminAccess } from './useAdminAccess';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useAdminAccess', () => {
  it('reveals admin navigation only after the server confirms access', async () => {
    let resolveResponse: ((value: unknown) => void) | undefined;
    const fetchMock = vi.fn().mockReturnValue(new Promise(resolve => { resolveResponse = resolve; }));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAdminAccess('admin-token'));
    expect(result.current).toBe(false);

    resolveResponse?.({ ok: true, json: async () => ({ isAdmin: true }) });
    await waitFor(() => expect(result.current).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith('/api/editor/access', {
      headers: { Authorization: 'Bearer admin-token' },
    });
  });

  it('fails closed for guests and rejected access checks', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAdminAccess(null));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(result.current).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith('/api/editor/access', { headers: {} });
  });
});
