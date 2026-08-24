import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameToolsMenu } from './GameToolsMenu';

afterEach(cleanup);

describe('GameToolsMenu', () => {
  it('keeps secondary mobile actions behind one toolbar control', () => {
    render(
      <GameToolsMenu
        zoomEnabled
        onToggleZoom={vi.fn()}
        onRestart={vi.fn()}
        onReport={vi.fn()}
      />,
    );

    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Game tools' }));
    expect(screen.getByRole('menu', { name: 'Game tools' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Show whole pitch' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Restart turn' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Report a problem' })).toBeTruthy();
  });

  it('runs an action and closes the menu', () => {
    const onReport = vi.fn();
    render(
      <GameToolsMenu
        zoomEnabled={false}
        onToggleZoom={vi.fn()}
        onRestart={vi.fn()}
        onReport={onReport}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Game tools' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Report a problem' }));
    expect(onReport).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('can reopen the current Tutorial guide', () => {
    const onTutorialGuide = vi.fn();
    render(
      <GameToolsMenu
        zoomEnabled={false}
        onTutorialGuide={onTutorialGuide}
        onToggleZoom={vi.fn()}
        onRestart={vi.fn()}
        onReport={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Game tools' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Tutorial guide' }));
    expect(onTutorialGuide).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
