import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginDialog } from './LoginDialog';

afterEach(cleanup);

function renderDialog(overrides: Partial<Parameters<typeof LoginDialog>[0]> = {}) {
  const props: Parameters<typeof LoginDialog>[0] = {
    authConfigured: true,
    googleSignedIn: false,
    mountGoogleSignInButton: vi.fn(async container => {
      const button = document.createElement('button');
      button.textContent = 'Sign in with Google';
      container.append(button);
    }),
    onAlias: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  return { ...render(<LoginDialog {...props} />), props };
}

describe('LoginDialog', () => {
  it('offers Google and guest access inside a labelled modal', async () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: 'Choose how to play' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Sign in with Google' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Play as guest' })).toBeTruthy();
  });

  it('collects a public alias after guest access is chosen', async () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Play as guest' }));

    const input = screen.getByRole('textbox', { name: 'Player name' });
    fireEvent.change(input, { target: { value: '  Sideline Sage  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(props.onAlias).toHaveBeenCalledWith('Sideline Sage');
  });

  it('closes on Escape and restores focus to the launcher', async () => {
    const launcher = document.createElement('button');
    document.body.append(launcher);
    launcher.focus();
    const { props, unmount } = renderDialog();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledOnce();
    unmount();
    await waitFor(() => expect(document.activeElement).toBe(launcher));
    launcher.remove();
  });
});
