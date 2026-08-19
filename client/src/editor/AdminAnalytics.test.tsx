import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminAnalytics } from './AdminAnalytics';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const analytics = {
  generatedAt: '2026-08-19T12:00:00.000Z', windowDays: 30,
  periodStart: '2026-07-20T12:00:00.000Z', periodEnd: '2026-08-19T12:00:00.000Z',
  overview: { gameSessions: 8, engagedSessions: 6, puzzleStarts: 10, puzzleCompletions: 4, completionRate: 0.4, medianActiveSeconds: 180, averagePuzzlesPerSession: 1.25 },
  funnel: [{ stage: 'Puzzle Started', count: 10 }, { stage: 'Meaningful Play', count: 6 }, { stage: 'Puzzle Completed', count: 4 }],
  trend: [{ date: '2026-08-19', gameSessions: 8, engagedSessions: 6, starts: 10, completions: 4 }],
  activeTimeDistribution: [{ label: '1-5m', count: 8 }],
  puzzlesPerSessionDistribution: [{ label: '1', count: 6 }, { label: '2', count: 2 }],
  puzzles: [{
    scenarioId: 'scenario-001', scenarioName: 'Opening Drive', starts: 10, engaged: 6, completions: 4,
    restarts: 2, explicitLeaves: 1, inactive: 3, completionRate: 0.4, medianActiveSeconds: 120,
    stopDepth: { '0': 2, '2-4': 4 }, lastActions: { none: 2, move: 4 },
  }],
  seriesFunnel: { starts: 3, stages: [{ position: 1, scenarioId: 'scenario-001', completions: 2 }], completions: 1, outcomes: { completed: 1 } },
  actions: [{ name: 'move', count: 12, perEngagedAttempt: 2 }],
  outcomes: [{ name: 'completed', count: 4 }, { name: 'inactive/closed', count: 3 }],
  interactions: [{ name: 'score-submit:succeeded', count: 3 }],
};

describe('AdminAnalytics', () => {
  it('renders game-only funnels, drop-off, and an accessible exact-value trend', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => analytics });
    vi.stubGlobal('fetch', fetchMock);
    render(<AdminAnalytics idToken="admin-token" />);

    expect(await screen.findByText('Opening Drive')).toBeDefined();
    expect(screen.getAllByText('40.0%')).toHaveLength(2);
    expect(screen.getByRole('img', { name: /10 puzzle starts and 4 completions/i })).toBeDefined();
    expect(screen.getByText('Incomplete Attempt Depth')).toBeDefined();
    expect(screen.queryByText('Unique Browsers')).toBeNull();
    expect(screen.queryByText('Audience')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '7 days' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/editor/analytics?window=7', {
      headers: { Authorization: 'Bearer admin-token' },
    }));
  });
});
