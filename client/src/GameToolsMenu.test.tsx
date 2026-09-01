import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameToolsMenu } from './GameToolsMenu';

afterEach(cleanup);

describe('GameToolsMenu', () => {
  it('keeps secondary mobile actions behind one toolbar control', () => {
    render(
      <GameToolsMenu
        onRestart={vi.fn()}
      />,
    );

    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Game tools' }));
    expect(screen.getByRole('menu', { name: 'Game tools' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Restart turn' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Report a problem' })).toBeNull();
  });

  it('runs an action and closes the menu', () => {
    const onRestart = vi.fn();
    render(
      <GameToolsMenu
        onRestart={onRestart}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Game tools' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Restart turn' }));
    expect(onRestart).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('can reopen the current Tutorial guide', () => {
    const onTutorialGuide = vi.fn();
    render(
      <GameToolsMenu
        onTutorialGuide={onTutorialGuide}
        onRestart={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Game tools' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Tutorial guide' }));
    expect(onTutorialGuide).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('runs reporting and closes the menu on phone-width toolbars', () => {
    const onReport = vi.fn();
    render(
      <GameToolsMenu
        onReport={onReport}
        onRestart={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Game tools' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Report a problem' }));
    expect(onReport).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('omits reporting when the dedicated toolbar control is visible', () => {
    render(
      <GameToolsMenu
        onRestart={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Game tools' }));
    expect(screen.queryByRole('menuitem', { name: 'Report a problem' })).toBeNull();
  });
});
