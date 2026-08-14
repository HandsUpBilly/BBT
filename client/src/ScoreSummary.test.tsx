import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ScoreSummary } from './ScoreSummary';
import type { LeaderboardEntry, Scenario } from './types';

const scenario: Scenario = {
  id: 'scenario-001',
  name: 'Opening Drive',
  description: 'Reach the end zone.',
  activeTeam: 'human',
  pieces: [{
    id: 'runner', team: 'human', role: 'catcher', name: 'Runner',
    ma: 7, st: 3, ag: 3, pa: 4, av: 8, skills: [],
    position: { col: 7, row: 6 }, hasBall: true,
  }],
};

function entry(playLog?: LeaderboardEntry['playLog']): LeaderboardEntry {
  return {
    id: 'score-1', scenarioId: scenario.id, name: 'Coach',
    probability: 1, diceCount: 0, date: '2026-08-14T12:00:00.000Z',
    moves: [],
    ...(playLog !== undefined ? { playLog } : {}),
  };
}

afterEach(cleanup);

describe('ScoreSummary play diagram', () => {
  it('reconstructs the completed route stored with a ranked score', () => {
    render(
      <ScoreSummary
        entry={entry([{
          kind: 'move', pieceName: 'Runner',
          from: { col: 7, row: 6 }, to: { col: 7, row: 0 },
        }])}
        scenario={scenario}
        onBack={() => undefined}
      />,
    );

    expect(screen.getByRole('img', { name: /completed play: 1 movement route/i })).toBeTruthy();
    expect(screen.queryByText(/diagram unavailable/i)).toBeNull();
  });

  it('explains why a legacy ranked score has no diagram', () => {
    render(<ScoreSummary entry={entry()} scenario={scenario} onBack={() => undefined} />);

    expect(screen.queryByRole('img', { name: /completed play/i })).toBeNull();
    expect(screen.getByText(/unavailable for scores submitted before this feature/i)).toBeTruthy();
  });
});
