import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminStatistics } from './AdminStatistics';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AdminStatistics', () => {
  it('renders anonymous personal-best summaries returned by the admin endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        generatedAt: '2026-08-02T12:00:00.000Z',
        totals: {
          recordedPlayers: 2,
          puzzlePersonalBests: 3,
          seriesPersonalBests: 1,
          averageProbability: 0.75,
          medianProbability: 0.75,
          averageDiceCount: 1,
        },
        puzzles: [{
          scenarioId: 'scenario-001',
          scenarioName: 'Opening Drive',
          recordedPlayers: 2,
          personalBests: 2,
          averageProbability: 0.75,
          medianProbability: 0.75,
          bestProbability: 1,
          averageDiceCount: 1,
          latestScoreAt: '2026-08-02T11:00:00.000Z',
        }],
        series: {
          recordedPlayers: 1,
          personalBests: 1,
          averageProbability: 0.5,
          medianProbability: 0.5,
          bestProbability: 0.5,
          averageDiceCount: 4,
          latestScoreAt: '2026-08-02T10:00:00.000Z',
        },
      }),
    }));

    render(<AdminStatistics idToken="admin-token" onBack={() => undefined} />);

    expect(await screen.findByText('Opening Drive')).toBeDefined();
    const summary = screen.getByLabelText('Performance summary');
    expect(within(summary).getByText('75.0%')).toBeDefined();
    expect(screen.getByText(/not attempt counts or completion rates/i)).toBeDefined();
    expect(fetch).toHaveBeenCalledWith('/api/editor/statistics', {
      headers: { Authorization: 'Bearer admin-token' },
    });
  });
});
