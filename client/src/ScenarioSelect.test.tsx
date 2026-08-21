import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScenarioSelect } from './ScenarioSelect';
import { scenarios } from './scenarios';
import { defaultSeries } from './series';
import { FREE_PLAY_SCENARIO_ID } from './tutorialLessons';

describe('ScenarioSelect Free Play', () => {
  it('lists only the final unrestricted tutorial board', () => {
    const freePlay = scenarios.find(scenario => scenario.id === FREE_PLAY_SCENARIO_ID);
    const guidedDrill = scenarios.find(scenario => scenario.id === 'scenario-001');
    expect(freePlay).toBeDefined();
    expect(guidedDrill).toBeDefined();

    render(
      <ScenarioSelect
        scenarios={scenarios}
        series={defaultSeries}
        onPlay={vi.fn()}
        onLeaderboard={vi.fn()}
        onStartSeries={vi.fn()}
        onSeriesLeaderboard={vi.fn()}
        onAdmin={vi.fn()}
        isAdmin={false}
        userMenu={<span />}
        reportButton={<span />}
      />,
    );

    expect(screen.getByText(/highest probability of meeting the puzzle's stated objective/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Free Play' }));

    expect(screen.getByText(freePlay!.name)).toBeTruthy();
    expect(screen.queryByText(guidedDrill!.name)).toBeNull();
  });
});
