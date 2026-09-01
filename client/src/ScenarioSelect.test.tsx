import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScenarioSelect } from './ScenarioSelect';
import { scenarios } from './scenarios';
import { defaultSeries } from './series';
import { FREE_PLAY_SCENARIO_ID } from './tutorialLessons';

afterEach(cleanup);

describe('ScenarioSelect Free Play', () => {
  it('renders uploaded series artwork', () => {
    const uploadedLogo = 'data:image/webp;base64,YWJj';
    render(
      <ScenarioSelect
        scenarios={scenarios}
        series={[{ ...defaultSeries, logo: uploadedLogo }]}
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
      />,
    );

    expect(screen.getByRole('img', { name: `${defaultSeries.name} logo` }).getAttribute('src')).toBe(uploadedLogo);
    expect(screen.getByText('01 Tutorial')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
    expect(screen.getByText(/Touchdown · 6 steps/)).toBeTruthy();
  });

  it('uses each series label and its actual list position', () => {
    render(
      <ScenarioSelect
        scenarios={scenarios}
        series={[
          { ...defaultSeries, id: 'league', name: 'Bromley League', label: 'League', scenarioIds: ['scenario-001'] },
          { ...defaultSeries, id: 'cup', name: 'Knockout Cup', label: 'Cup' },
        ]}
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
      />,
    );

    expect(screen.getByText('01 League')).toBeTruthy();
    expect(screen.getByText('02 Cup')).toBeTruthy();
    expect(screen.getByText(/Touchdown · 1 step$/)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Play' })).toHaveLength(2);
  });

  it('tints each series row from its two team colours', () => {
    const { container } = render(
      <ScenarioSelect
        scenarios={scenarios}
        series={[{ ...defaultSeries, teams: ['imperial-nobility', 'black-orc'] }]}
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
      />,
    );

    const row = container.querySelector<HTMLElement>('.series-row');
    expect(row?.style.getPropertyValue('--series-team-a-rgb')).toBe('103 79 137');
    expect(row?.style.getPropertyValue('--series-team-b-rgb')).toBe('74 96 43');
  });

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
      />,
    );

    expect(screen.getByText(/highest probability of meeting the puzzle's stated objective/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Free Play' }));

    expect(screen.getByText('These matches can be played individually.')).toBeTruthy();
    expect(screen.getByText('From the tutorial')).toBeTruthy();
    expect(screen.getByText('The final puzzle from the tutorial, with every action available.')).toBeTruthy();
    expect(screen.getByText(freePlay!.name)).toBeTruthy();
    expect(screen.queryByText(guidedDrill!.name)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Specials' }));
    expect(screen.getByText('No special matches are available yet.')).toBeTruthy();
    expect(screen.queryByText(freePlay!.name)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Series' }));
    expect(screen.getByText(freePlay!.name)).toBeTruthy();
  });

  it('does not label a standalone copied puzzle as tutorial content', () => {
    const copiedPuzzle = {
      ...scenarios.find(scenario => scenario.id === FREE_PLAY_SCENARIO_ID)!,
      id: 'loose-ball-copy',
      name: 'Loose Ball Copy',
    };
    render(
      <ScenarioSelect
        scenarios={[copiedPuzzle]}
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
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Free Play' }));
    expect(screen.getByText('Loose Ball Copy')).toBeTruthy();
    expect(screen.queryByText('From the tutorial')).toBeNull();
    expect(screen.queryByText('The final puzzle from the tutorial, with every action available.')).toBeNull();
  });

  it('labels a Free Play puzzle with its actual owning series', () => {
    const leaguePuzzle = {
      ...scenarios.find(scenario => scenario.id === FREE_PLAY_SCENARIO_ID)!,
      id: 'league-final',
      name: 'League Final',
    };
    render(
      <ScenarioSelect
        scenarios={[leaguePuzzle]}
        series={[{ ...defaultSeries, id: 'bromley', name: 'Bromley Blood Bowl League', label: 'League', scenarioIds: [leaguePuzzle.id] }]}
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
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Free Play' }));
    expect(screen.getByText('From Bromley Blood Bowl League')).toBeTruthy();
    expect(screen.queryByText('From the tutorial')).toBeNull();
    expect(screen.queryByText('The final puzzle from the tutorial, with every action available.')).toBeNull();
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
      />,
    );

    const utilityNav = within(container).getByRole('navigation', { name: 'Site controls' });
    fireEvent.click(within(utilityNav).getByRole('button', { name: 'Admin' }));
    fireEvent.click(within(utilityNav).getByRole('button', { name: 'Help' }));
    fireEvent.click(within(utilityNav).getByRole('button', { name: 'Settings' }));
    fireEvent.click(within(utilityNav).getByRole('button', { name: 'About' }));

    expect(onAdmin).toHaveBeenCalledOnce();
    expect(onHelp).toHaveBeenCalledOnce();
    expect(onSettings).toHaveBeenCalledOnce();
    expect(onAbout).toHaveBeenCalledOnce();
    expect(within(container).queryByRole('button', { name: 'Report a problem' })).toBeNull();
    expect(within(container).getAllByRole('tab')).toHaveLength(2);
  });
});
