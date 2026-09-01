import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadScenarioData } from './runtime';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const scenario = (id: string, visibility: { published?: boolean; adminEnabled?: boolean } = {}) => ({
  id,
  name: id,
  description: `${id} description`,
  activeTeam: 'human',
  objective: 'touchdown',
  ballPosition: null,
  pieces: [],
  ...visibility,
});

describe('runtime scenario visibility', () => {
  it('loads protected admin-enabled content without exposing creator-only content', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        scenarios: [
          scenario('public'),
          scenario('admin-only', { published: false, adminEnabled: true }),
          scenario('creator-only', { published: false }),
        ],
        series: [
          { id: 'public-series', name: 'Public', description: '', scenarioIds: ['public', 'admin-only', 'creator-only'], order: 0 },
          { id: 'admin-series', name: 'Admin', description: '', scenarioIds: ['admin-only'], published: false, adminEnabled: true, order: 1 },
          { id: 'hidden-series', name: 'Hidden', description: '', scenarioIds: ['creator-only'], published: false, order: 2 },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const data = await loadScenarioData({ admin: true, idToken: 'admin-token' });

    expect(fetchMock).toHaveBeenCalledWith('/api/editor/scenarios', {
      headers: { Authorization: 'Bearer admin-token' },
    });
    expect(data.scenarios.map(item => item.id)).toEqual(['public', 'admin-only']);
    expect(data.series.map(item => item.id)).toEqual(['public-series', 'admin-series']);
    expect(data.series[0].scenarioIds).toEqual(['public', 'admin-only']);
  });

  it('uses only the public endpoint for non-admins', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ scenarios: [scenario('public')], series: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const data = await loadScenarioData();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith('/api/scenarios');
    expect(data.scenarios.map(item => item.id)).toEqual(['public']);
  });
});
