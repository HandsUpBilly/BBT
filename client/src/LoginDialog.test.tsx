import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginDialog } from './LoginDialog';

afterEach(cleanup);

function renderDialog(overrides: Partial<Parameters<typeof LoginDialog>[0]> = {}) {
  const props: Parameters<typeof LoginDialog>[0] = {
    providers: { google: true, discord: true, email: true },
    signedIn: false,
    pendingMagicLink: false,
    authError: null,
    mountGoogleSignInButton: vi.fn(async container => {
      const button = document.createElement('button');
      button.textContent = 'Sign in with Google';
      container.append(button);
    }),
    onDiscord: vi.fn(),
    onSendMagicLink: vi.fn().mockResolvedValue(undefined),
    onCompleteMagicLink: vi.fn().mockResolvedValue(undefined),
    onClearAuthError: vi.fn(),
    onAlias: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  return { ...render(<LoginDialog {...props} />), props };
}

describe('LoginDialog', () => {
  it('offers Google, Discord, email, and guest access inside a labelled modal', async () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: 'Log in' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Sign in with Google' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log in with Discord' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log in with email' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Play as guest' })).toBeTruthy();
  });

  it('sends a magic link and shows a neutral inbox confirmation', async () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Log in with email' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Email address' }), { target: { value: 'coach@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Email link' }));
    await waitFor(() => expect(props.onSendMagicLink).toHaveBeenCalledWith('coach@example.com'));
    expect(screen.getByText('Check your inbox')).toBeTruthy();
  });

  it('requires a deliberate confirmation before consuming a magic link', async () => {
    const { props } = renderDialog({ pendingMagicLink: true });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Turn 16' }));
    await waitFor(() => expect(props.onCompleteMagicLink).toHaveBeenCalledOnce());
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
