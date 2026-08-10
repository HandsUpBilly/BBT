import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UserMenu } from './UserMenu';

afterEach(cleanup);

function openMenu(name = 'Endzone Expert') {
  fireEvent.click(screen.getByRole('button', { name: `Player menu for ${name}` }));
}

describe('UserMenu', () => {
  it('falls back to initials when no avatar is set', () => {
    const { container } = render(<UserMenu name="Endzone Expert" />);
    expect(container.querySelector('.user-menu__avatar--fallback')?.textContent).toBe('EE');
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders the avatar image when one is set', () => {
    const { container } = render(<UserMenu name="Endzone Expert" avatar="data:image/webp;base64,AAAA" />);
    expect(container.querySelector('img.user-menu__avatar')).toBeTruthy();
    expect(container.querySelector('.user-menu__avatar--fallback')).toBeNull();
  });

  it('falls back to initials if the avatar image fails to load', () => {
    const { container } = render(<UserMenu name="Endzone Expert" avatar="data:image/webp;base64,AAAA" />);
    const img = container.querySelector('img.user-menu__avatar') as HTMLImageElement;

    fireEvent.error(img);

    expect(container.querySelector('.user-menu__avatar--fallback')?.textContent).toBe('EE');
    expect(container.querySelector('img')).toBeNull();
  });

  it('has no Settings item when onSettings is not supplied', () => {
    render(<UserMenu name="Endzone Expert" />);
    openMenu();
    expect(screen.queryByRole('menuitem', { name: 'Settings' })).toBeNull();
  });

  it('closes the menu and calls onSettings when Settings is chosen', () => {
    const onSettings = vi.fn();
    render(<UserMenu name="Endzone Expert" onSettings={onSettings} />);
    openMenu();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Settings' }));

    expect(onSettings).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('still offers Log Out alongside Settings', () => {
    const onSignOut = vi.fn();
    render(<UserMenu name="Endzone Expert" onSettings={() => undefined} onSignOut={onSignOut} />);
    openMenu();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Log Out' }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });
});
