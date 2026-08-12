import { useRef, useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { encodeAvatarFile, validateAvatarFile, AVATAR_ALLOWED_TYPES } from './avatarImage';
import type { PitchSurface, TokenStyle } from './prefs';
import detailedPitchPreview from './assets/token-style-previews/detailed.webp';
import tacticalPitchPreview from './assets/token-style-previews/tactical.webp';
import plainPitchPreview from './assets/token-style-previews/plain.webp';
import './SettingsScreen.css';

interface Props {
  identityName: string;
  isGuest: boolean;
  onRename: (name: string) => void;
  avatar: string | undefined;
  onAvatarChange: (dataUrl: string | undefined) => void;
  tokenStyle: TokenStyle;
  onTokenStyleChange: (style: TokenStyle) => void;
  pitchSurface: PitchSurface;
  onPitchSurfaceChange: (surface: PitchSurface) => void;
  showCoordinates: boolean;
  onShowCoordinatesChange: (show: boolean) => void;
  onBack: () => void;
}

function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase();
}

const AVATAR_ACCEPT = AVATAR_ALLOWED_TYPES.join(',');

export function SettingsScreen({
  identityName, isGuest, onRename,
  avatar, onAvatarChange,
  tokenStyle, onTokenStyleChange,
  pitchSurface, onPitchSurfaceChange,
  showCoordinates, onShowCoordinatesChange,
  onBack,
}: Props) {
  const [name, setName] = useState(identityName);
  const [pendingRename, setPendingRename] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string>();
  const [avatarBusy, setAvatarBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const trimmedName = name.trim();
  const nameChanged = trimmedName.length > 0 && trimmedName !== identityName;

  function commitRename(newName: string) {
    onRename(newName);
    setName(newName);
  }

  function handleSaveName() {
    if (!nameChanged) return;
    // A guest's personal best is matched by name, not by an account id (see
    // docs/agent-context/leaderboard-and-auth.md), so renaming here strands it
    // under the old name. A signed-in player is matched by their Google
    // subject id and keeps their history regardless of what they're called.
    if (isGuest) {
      setPendingRename(trimmedName);
    } else {
      commitRename(trimmedName);
    }
  }

  async function handleAvatarFile(file: File) {
    setAvatarError(undefined);
    const invalidReason = validateAvatarFile(file);
    if (invalidReason) {
      setAvatarError(invalidReason);
      return;
    }
    setAvatarBusy(true);
    try {
      const dataUrl = await encodeAvatarFile(file);
      onAvatarChange(dataUrl);
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'Could not process that image.');
    } finally {
      setAvatarBusy(false);
    }
  }

  return (
    <div className="settings-screen">
      <div className="settings-screen__header">
        <button className="lb-back-btn" onClick={onBack}>← Back</button>
        <div>
          <h2 className="settings-screen__title">Settings</h2>
          <p className="settings-screen__subtitle">Your profile and display preferences</p>
        </div>
      </div>

      <section className="settings-screen__section">
        <h3 className="settings-screen__section-title">Display name</h3>
        <p className="settings-screen__section-help">
          This is the name shown on leaderboards and reports.
          {isGuest && ' Changing it starts a new personal best — your current one stays under the old name.'}
        </p>
        <div className="settings-screen__name-row">
          <input
            className="settings-screen__name-input"
            type="text"
            maxLength={32}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSaveName()}
            aria-label="Display name"
          />
          <button className="btn btn--primary" disabled={!nameChanged} onClick={handleSaveName}>
            Save
          </button>
        </div>
      </section>

      <section className="settings-screen__section">
        <h3 className="settings-screen__section-title">Pitch</h3>
        <p className="settings-screen__section-help">
          Choose the playing surface and whether coordinate labels surround the board.
        </p>
        <div className="settings-screen__surface-toggle" role="radiogroup" aria-label="Pitch surface">
          <button
            type="button"
            role="radio"
            aria-checked={pitchSurface === 'grass'}
            className={`settings-screen__surface-option${pitchSurface === 'grass' ? ' settings-screen__surface-option--selected' : ''}`}
            onClick={() => onPitchSurfaceChange('grass')}
          >
            <span className="settings-screen__surface-swatch settings-screen__surface-swatch--grass" aria-hidden="true" />
            <span><strong>Grass</strong><small>Worn match-day turf</small></span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={pitchSurface === 'slate'}
            className={`settings-screen__surface-option${pitchSurface === 'slate' ? ' settings-screen__surface-option--selected' : ''}`}
            onClick={() => onPitchSurfaceChange('slate')}
          >
            <span className="settings-screen__surface-swatch settings-screen__surface-swatch--slate" aria-hidden="true" />
            <span><strong>Slate / tile</strong><small>Dark dungeon slabs</small></span>
          </button>
        </div>
        <label className="settings-screen__coordinate-toggle">
          <span>
            <strong>Cell numbering</strong>
            <small>Show letters and numbers around the pitch</small>
          </span>
          <input
            type="checkbox"
            checked={showCoordinates}
            onChange={event => onShowCoordinatesChange(event.target.checked)}
          />
        </label>
      </section>

      <section className="settings-screen__section">
        <h3 className="settings-screen__section-title">Avatar</h3>
        {isGuest ? (
          <p className="settings-screen__section-help">Sign in with Google to set an avatar.</p>
        ) : (
          <>
            <p className="settings-screen__section-help">
              Shown only to you, on this device — not on leaderboards.
            </p>
            <div className="settings-screen__avatar-row">
              <span className="settings-screen__avatar-preview">
                {avatar ? (
                  <img src={avatar} alt="" />
                ) : (
                  <span className="settings-screen__avatar-fallback">{initials(identityName)}</span>
                )}
              </span>
              <div className="settings-screen__avatar-actions">
                <input
                  ref={fileInputRef}
                  className="settings-screen__file-input"
                  type="file"
                  accept={AVATAR_ACCEPT}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void handleAvatarFile(file);
                  }}
                />
                <button
                  className="btn btn--secondary"
                  disabled={avatarBusy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {avatarBusy ? 'Processing…' : avatar ? 'Change avatar' : 'Upload avatar'}
                </button>
                {avatar && (
                  <button className="btn btn--ghost" onClick={() => onAvatarChange(undefined)}>
                    Remove
                  </button>
                )}
              </div>
            </div>
            {avatarError && <p className="settings-screen__error" role="alert">{avatarError}</p>}
          </>
        )}
      </section>

      <section className="settings-screen__section">
        <h3 className="settings-screen__section-title">Player tokens</h3>
        <p className="settings-screen__section-help">
          Choose how much detail the players and pitch show.
        </p>
        <div className="settings-screen__token-toggle" role="radiogroup" aria-label="Player token style">
          <button
            type="button"
            role="radio"
            aria-checked={tokenStyle === 'portrait'}
            className={`settings-screen__token-option${tokenStyle === 'portrait' ? ' settings-screen__token-option--selected' : ''}`}
            onClick={() => onTokenStyleChange('portrait')}
          >
            <span className="settings-screen__token-preview" aria-hidden="true">
              <img src={detailedPitchPreview} alt="" />
            </span>
            <span className="settings-screen__token-copy">
              <strong>Detailed</strong>
              <span>Full portraits and textured tabletop turf</span>
            </span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={tokenStyle === 'simple'}
            className={`settings-screen__token-option${tokenStyle === 'simple' ? ' settings-screen__token-option--selected' : ''}`}
            onClick={() => onTokenStyleChange('simple')}
          >
            <span className="settings-screen__token-preview" aria-hidden="true">
              <img src={tacticalPitchPreview} alt="" />
            </span>
            <span className="settings-screen__token-copy">
              <strong>Tactical</strong>
              <span>Position symbols on a restrained tactical grid</span>
            </span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={tokenStyle === 'plain'}
            className={`settings-screen__token-option${tokenStyle === 'plain' ? ' settings-screen__token-option--selected' : ''}`}
            onClick={() => onTokenStyleChange('plain')}
          >
            <span className="settings-screen__token-preview" aria-hidden="true">
              <img src={plainPitchPreview} alt="" />
            </span>
            <span className="settings-screen__token-copy">
              <strong>Plain</strong>
              <span>Role codes on a clean diagrammatic pitch</span>
            </span>
          </button>
        </div>
      </section>

      {pendingRename !== null && (
        <ConfirmDialog
          title="Change display name?"
          message={`Your personal bests are tracked under "${identityName}". Renaming to "${pendingRename}" starts fresh — the old name's scores stay on the board under that name.`}
          confirmLabel="Change Name"
          cancelLabel="Keep Current Name"
          onConfirm={() => { commitRename(pendingRename); setPendingRename(null); }}
          onCancel={() => setPendingRename(null)}
        />
      )}
    </div>
  );
}
