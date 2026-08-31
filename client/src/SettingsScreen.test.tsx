import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsScreen } from './SettingsScreen';

afterEach(cleanup);

function renderScreen(overrides: Partial<ComponentProps<typeof SettingsScreen>> = {}) {
  const props = {
    identityName: 'Endzone Expert',
    isGuest: false,
    onRename: vi.fn(),
    avatar: undefined,
    avatarIsLocalOnly: false,
    googleAvatarAvailable: false,
    onAvatarUpload: vi.fn().mockResolvedValue(undefined),
    onUseGoogleAvatar: vi.fn().mockResolvedValue(undefined),
    onRemoveAvatar: vi.fn().mockResolvedValue(undefined),
    country: '',
    onCountryChange: vi.fn().mockResolvedValue(undefined),
    tokenStyle: 'portrait' as const,
    onTokenStyleChange: vi.fn(),
    pitchSurface: 'grass' as const,
    onPitchSurfaceChange: vi.fn(),
    boardSize: 'medium' as const,
    onBoardSizeChange: vi.fn(),
    showCoordinates: true,
    onShowCoordinatesChange: vi.fn(),
    showTutorialGuidance: true,
    onShowTutorialGuidanceChange: vi.fn(),
    onBack: vi.fn(),
    ...overrides,
  };
  render(<SettingsScreen {...props} />);
  return props;
}

describe('display name', () => {
  it('disables Save until the name actually changes', () => {
    renderScreen();
    expect((screen.getByRole('button', { name: 'Save name' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('renames a signed-in player immediately, with no confirmation', () => {
    const props = renderScreen({ isGuest: false });
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'New Name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));

    expect(props.onRename).toHaveBeenCalledWith('New Name');
    expect(screen.queryByText(/starts fresh/)).toBeNull();
  });

  it('warns a guest that renaming strands their personal best, and waits for confirmation', () => {
    const props = renderScreen({ isGuest: true, identityName: 'Old Name' });
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'New Name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));

    expect(props.onRename).not.toHaveBeenCalled();
    expect(screen.getByText(/starts a new record/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Change Name' }));
    expect(props.onRename).toHaveBeenCalledWith('New Name');
  });

  it('lets the guest back out of a rename without calling onRename', () => {
    const props = renderScreen({ isGuest: true, identityName: 'Old Name' });
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'New Name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep Current Name' }));

    expect(props.onRename).not.toHaveBeenCalled();
  });
});

describe('avatar', () => {
  it('is unavailable for guests', () => {
    renderScreen({ isGuest: true });
    expect(screen.getByText(/Sign in with Google to set an avatar/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Upload photo' })).toBeNull();
  });

  it('offers upload for a signed-in player with no avatar yet', () => {
    renderScreen({ isGuest: false, avatar: undefined });
    expect(screen.getByRole('button', { name: 'Upload photo' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
  });

  it('offers removal once a public avatar is set', async () => {
    const props = renderScreen({ isGuest: false, avatar: 'data:image/webp;base64,AAAA' });
    expect(screen.getByRole('button', { name: 'Upload photo' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(props.onRemoveAvatar).toHaveBeenCalledOnce());
  });

  it('offers the verified Google photo when one is available', async () => {
    const props = renderScreen({ googleAvatarAvailable: true });
    fireEvent.click(screen.getByRole('button', { name: 'Use Google photo' }));
    await waitFor(() => expect(props.onUseGoogleAvatar).toHaveBeenCalledOnce());
  });

  it('offers to publish an existing local-only avatar', async () => {
    const props = renderScreen({
      avatar: 'data:image/webp;base64,AAAA', avatarIsLocalOnly: true,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publish current' }));
    await waitFor(() => expect(props.onAvatarUpload).toHaveBeenCalledWith('data:image/webp;base64,AAAA'));
  });

  it('shows a validation error for an unsupported file type without uploading it', async () => {
    const props = renderScreen({ isGuest: false });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'avatar.gif', { type: 'image/gif' });

    fireEvent.change(input, { target: { files: [file] } });

    expect((await screen.findByRole('alert')).textContent).toMatch(/PNG, JPEG, or WebP/);
    expect(props.onAvatarUpload).not.toHaveBeenCalled();
  });
});

describe('country or nationality', () => {
  it('saves optional public profile text for a signed-in player', async () => {
    const props = renderScreen();
    fireEvent.change(screen.getByLabelText('Country / nationality'), { target: { value: ' Scotland ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save country' }));
    await waitFor(() => expect(props.onCountryChange).toHaveBeenCalledWith('Scotland'));
  });

  it('does not offer a profile field to guests', () => {
    renderScreen({ isGuest: true });
    expect(screen.queryByLabelText('Country / nationality')).toBeNull();
  });
});

describe('player token style', () => {
  it('reflects the current selection', () => {
    renderScreen({ tokenStyle: 'simple' });
    expect(screen.getByRole('radio', { name: /Tactical/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: /Detailed/ }).getAttribute('aria-checked')).toBe('false');
  });

  it('shows a pitch comparison visual for every token level', () => {
    renderScreen();

    expect(screen.getByRole('radio', { name: /Detailed/ }).querySelector('img')?.getAttribute('src')).toContain('detailed.webp');
    expect(screen.getByRole('radio', { name: /Tactical/ }).querySelector('img')?.getAttribute('src')).toContain('tactical.webp');
    expect(screen.getByRole('radio', { name: /Plain/ }).querySelector('img')?.getAttribute('src')).toContain('plain.webp');
  });

  it('reports a choice without assuming it becomes the new selection', () => {
    const props = renderScreen({ tokenStyle: 'portrait' });
    fireEvent.click(screen.getByRole('radio', { name: /Tactical/ }));
    expect(props.onTokenStyleChange).toHaveBeenCalledWith('simple');
  });

  it('offers a plain role-disc option', () => {
    const props = renderScreen({ tokenStyle: 'portrait' });
    fireEvent.click(screen.getByRole('radio', { name: /Plain/ }));
    expect(props.onTokenStyleChange).toHaveBeenCalledWith('plain');
  });
});

describe('pitch display', () => {
  it('reports a slate surface choice', () => {
    const props = renderScreen({ pitchSurface: 'grass' });
    fireEvent.click(screen.getByRole('radio', { name: /Slate \/ tile/ }));
    expect(props.onPitchSurfaceChange).toHaveBeenCalledWith('slate');
  });

  it('reports when cell numbering is turned off', () => {
    const props = renderScreen({ showCoordinates: true });
    fireEvent.click(screen.getByRole('checkbox', { name: /Cell numbering/ }));
    expect(props.onShowCoordinatesChange).toHaveBeenCalledWith(false);
  });

  it('reflects the current board size selection', () => {
    renderScreen({ boardSize: 'large' });
    expect(screen.getByRole('radio', { name: /Large/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: /Medium/ }).getAttribute('aria-checked')).toBe('false');
  });

  it('reports a board size choice', () => {
    const props = renderScreen({ boardSize: 'medium' });
    fireEvent.click(screen.getByRole('radio', { name: /Small/ }));
    expect(props.onBoardSizeChange).toHaveBeenCalledWith('small');
  });
});

describe('tutorial guidance', () => {
  it('is on by default and reports being turned off', () => {
    const props = renderScreen({ showTutorialGuidance: true });
    const toggle = screen.getByRole('checkbox', { name: /Tutorial guidance/ });

    expect((toggle as HTMLInputElement).checked).toBe(true);
    fireEvent.click(toggle);
    expect(props.onShowTutorialGuidanceChange).toHaveBeenCalledWith(false);
  });

  it('reports being turned back on', () => {
    const props = renderScreen({ showTutorialGuidance: false });
    fireEvent.click(screen.getByRole('checkbox', { name: /Tutorial guidance/ }));
    expect(props.onShowTutorialGuidanceChange).toHaveBeenCalledWith(true);
  });
});

it('calls onBack from the header', () => {
  const props = renderScreen();
  fireEvent.click(screen.getByRole('button', { name: '← Back' }));
  expect(props.onBack).toHaveBeenCalledOnce();
});
