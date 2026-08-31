import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchOwnProfile, playerAvatarUrl, saveOwnProfile } from './playerProfile';

afterEach(() => vi.unstubAllGlobals());

describe('player profile API', () => {
  it('loads and saves through the authenticated profile endpoint', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ userId: 'user-1', country: 'Scotland' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ userId: 'user-1', country: 'Scottish', avatarVersion: 'v2' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    expect(await fetchOwnProfile('token')).toMatchObject({ country: 'Scotland' });
    expect(await saveOwnProfile({ country: 'Scottish', avatar: { source: 'google' } }, 'token'))
      .toMatchObject({ country: 'Scottish', avatarVersion: 'v2' });
    expect(fetchMock).toHaveBeenLastCalledWith('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
      body: JSON.stringify({ country: 'Scottish', avatar: { source: 'google' } }),
    });
  });

  it('surfaces server errors and builds a cache-busted public avatar URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Avatar must be a processed WebP image' }),
    }));

    await expect(saveOwnProfile({ avatar: null }, 'token'))
      .rejects.toThrow('Avatar must be a processed WebP image');
    expect(playerAvatarUrl('user / 1', 'version:1'))
      .toBe('/api/avatar/user%20%2F%201?v=version%3A1');
  });
});
