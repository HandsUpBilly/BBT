import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminStatistics } from './AdminStatistics';

afterEach(() => {
  cleanup();
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
        puzzles: [
          {
            scenarioId: 'scenario-001',
            scenarioName: 'Opening Drive',
            recordedPlayers: 2,
            personalBests: 2,
            averageProbability: 0.75,
            medianProbability: 0.75,
            bestProbability: 1,
            averageDiceCount: 1,
            latestScoreAt: '2026-08-02T11:00:00.000Z',
          },
          {
            scenarioId: 'scenario-004',
            scenarioName: 'Ironjaw Gauntlet',
            recordedPlayers: 1,
            personalBests: 1,
            averageProbability: 0.5,
            medianProbability: 0.5,
            bestProbability: 0.5,
            averageDiceCount: 3,
            latestScoreAt: '2026-08-01T11:00:00.000Z',
          },
        ],
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

  it('filters the table and exposes sortable puzzle columns', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        generatedAt: '2026-08-02T12:00:00.000Z',
        totals: { recordedPlayers: 2, puzzlePersonalBests: 2, seriesPersonalBests: 0, averageProbability: 0.5, medianProbability: 0.5, averageDiceCount: 2 },
        puzzles: [
          { scenarioId: 'scenario-002', scenarioName: 'Zulu', recordedPlayers: 1, personalBests: 1, averageProbability: 0.4, medianProbability: 0.4, bestProbability: 0.4, averageDiceCount: 2, latestScoreAt: null },
          { scenarioId: 'scenario-001', scenarioName: 'Alpha', recordedPlayers: 1, personalBests: 1, averageProbability: 0.8, medianProbability: 0.8, bestProbability: 0.8, averageDiceCount: 1, latestScoreAt: null },
        ],
        series: { recordedPlayers: 0, personalBests: 0, averageProbability: null, medianProbability: null, bestProbability: null, averageDiceCount: null, latestScoreAt: null },
      }),
    }));

    render(<AdminStatistics idToken="admin-token" onBack={() => undefined} />);
    await screen.findByText('Zulu');

    fireEvent.click(screen.getByRole('button', { name: 'Puzzle' }));
    const rows = screen.getAllByRole('row');
    expect(within(rows[1]).getByText('Alpha')).toBeDefined();

    fireEvent.change(screen.getByPlaceholderText('Name or scenario ID'), { target: { value: 'Zulu' } });
    expect(screen.getByText('1 of 2 puzzles')).toBeDefined();
    expect(screen.queryByText('Alpha')).toBeNull();
    expect(screen.getByText('Zulu')).toBeDefined();
  });
});
