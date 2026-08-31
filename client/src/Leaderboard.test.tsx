import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Leaderboard } from './Leaderboard';
import type { LeaderboardEntry, Scenario } from './types';

const scenario: Scenario = {
  id: 'profile-test',
  name: 'Profile Test',
  description: 'Reach the end zone.',
  activeTeam: 'human',
  pieces: [],
};

afterEach(cleanup);

describe('Leaderboard public profiles', () => {
  it('renders the public avatar and country attached by the server', () => {
    const entry: LeaderboardEntry = {
      id: 'score-1',
      scenarioId: scenario.id,
      userId: 'google-user-1',
      name: 'Coach Billy',
      probability: 0.75,
      diceCount: 2,
      date: '2026-08-31T12:00:00.000Z',
      moves: [],
      profile: {
        userId: 'google-user-1',
        country: 'Wales',
        avatarVersion: '2026-08-31T12:00:00.000Z',
      },
    };

    const { container } = render(
      <Leaderboard scenario={scenario} onBack={() => undefined} initialEntries={[entry]} />,
    );

    expect(screen.getByText('Wales')).toBeTruthy();
    expect(container.querySelector<HTMLImageElement>('.lb-table__avatar')?.src)
      .toContain('/api/avatar/google-user-1?v=2026-08-31T12%3A00%3A00.000Z');
  });
});
