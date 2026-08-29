import { fireEvent, render, screen, within } from '@testing-library/react';
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
        onHelp={vi.fn()}
        onSettings={vi.fn()}
        onAbout={vi.fn()}
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

  it('keeps utility actions in the top bar and play modes in the bottom bar', () => {
    const onAdmin = vi.fn();
    const onHelp = vi.fn();
    const onSettings = vi.fn();
    const onAbout = vi.fn();

    const { container } = render(
      <ScenarioSelect
        scenarios={scenarios}
        series={defaultSeries}
        onPlay={vi.fn()}
        onLeaderboard={vi.fn()}
        onStartSeries={vi.fn()}
        onSeriesLeaderboard={vi.fn()}
        onAdmin={onAdmin}
        onHelp={onHelp}
        onSettings={onSettings}
        onAbout={onAbout}
        isAdmin
        userMenu={<span />}
        reportButton={<span />}
      />,
    );

    const utilityNav = within(container).getByRole('navigation', { name: 'Site controls' });
    fireEvent.click(within(utilityNav).getByRole('button', { name: 'Admin' }));
    fireEvent.click(within(utilityNav).getByRole('button', { name: 'Help & rules' }));
    fireEvent.click(within(utilityNav).getByRole('button', { name: 'Settings' }));
    fireEvent.click(within(utilityNav).getByRole('button', { name: 'About' }));

    expect(onAdmin).toHaveBeenCalledOnce();
    expect(onHelp).toHaveBeenCalledOnce();
    expect(onSettings).toHaveBeenCalledOnce();
    expect(onAbout).toHaveBeenCalledOnce();
    expect(within(container).getAllByRole('tab')).toHaveLength(2);
  });
});
