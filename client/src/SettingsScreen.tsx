import { useRef, useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { PlayerAvatar } from './PlayerAvatar';
import { encodeAvatarFile, validateAvatarFile, AVATAR_ALLOWED_TYPES } from './avatarImage';
import type { BoardSize, PitchSurface, TokenStyle } from './prefs';
import detailedPitchPreview from './assets/token-style-previews/detailed.webp';
import tacticalPitchPreview from './assets/token-style-previews/tactical.webp';
import plainPitchPreview from './assets/token-style-previews/plain.webp';
import './SettingsScreen.css';

interface Props {
  identityName: string;
  isGuest: boolean;
  onRename: (name: string) => void;
  avatar: string | undefined;
  avatarIsLocalOnly: boolean;
  googleAvatarAvailable: boolean;
  onAvatarUpload: (dataUrl: string) => Promise<void>;
  onUseGoogleAvatar: () => Promise<void>;
  onRemoveAvatar: () => Promise<void>;
  country: string;
  onCountryChange: (country: string) => Promise<void>;
  tokenStyle: TokenStyle;
  onTokenStyleChange: (style: TokenStyle) => void;
  pitchSurface: PitchSurface;
  onPitchSurfaceChange: (surface: PitchSurface) => void;
  boardSize: BoardSize;
  onBoardSizeChange: (size: BoardSize) => void;
  showCoordinates: boolean;
  onShowCoordinatesChange: (show: boolean) => void;
  showTutorialGuidance: boolean;
  onShowTutorialGuidanceChange: (enabled: boolean) => void;
  onBack: () => void;
}

const AVATAR_ACCEPT = AVATAR_ALLOWED_TYPES.join(',');

export function SettingsScreen({
  identityName, isGuest, onRename,
  avatar, avatarIsLocalOnly, googleAvatarAvailable,
  onAvatarUpload, onUseGoogleAvatar, onRemoveAvatar,
  country, onCountryChange,
  tokenStyle, onTokenStyleChange,
  pitchSurface, onPitchSurfaceChange,
  boardSize, onBoardSizeChange,
  showCoordinates, onShowCoordinatesChange,
  showTutorialGuidance, onShowTutorialGuidanceChange,
  onBack,
}: Props) {
  const [name, setName] = useState(identityName);
  const [pendingRename, setPendingRename] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string>();
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarNotice, setAvatarNotice] = useState<string>();
  const [countryDraft, setCountryDraft] = useState({ source: country, value: country });
  const [countryBusy, setCountryBusy] = useState(false);
  const [countryError, setCountryError] = useState<string>();
  const [countrySaved, setCountrySaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const trimmedName = name.trim();
  const nameChanged = trimmedName.length > 0 && trimmedName !== identityName;
  const countryValue = countryDraft.source === country ? countryDraft.value : country;
  const trimmedCountry = countryValue.trim();
  const countryChanged = trimmedCountry !== country;

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
    setAvatarNotice(undefined);
    const invalidReason = validateAvatarFile(file);
    if (invalidReason) {
      setAvatarError(invalidReason);
      return;
    }
    setAvatarBusy(true);
    try {
      const dataUrl = await encodeAvatarFile(file);
      await onAvatarUpload(dataUrl);
      setAvatarNotice('Public avatar updated.');
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'Could not process that image.');
    } finally {
      setAvatarBusy(false);
    }
  }

  async function runAvatarChange(change: () => Promise<void>, success: string) {
    setAvatarBusy(true);
    setAvatarError(undefined);
    setAvatarNotice(undefined);
    try {
      await change();
      setAvatarNotice(success);
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'Could not update your public avatar.');
    } finally {
      setAvatarBusy(false);
    }
  }

  async function saveCountry() {
    if (!countryChanged) return;
    setCountryBusy(true);
    setCountryError(undefined);
    setCountrySaved(false);
    try {
      await onCountryChange(trimmedCountry);
      setCountryDraft({ source: trimmedCountry, value: trimmedCountry });
      setCountrySaved(true);
    } catch (error) {
      setCountryError(error instanceof Error ? error.message : 'Could not update your country or nationality.');
    } finally {
      setCountryBusy(false);
    }
  }

  return (
    <div className="settings-screen">
      <div className="settings-screen__header">
        <button className="lb-back-btn" onClick={onBack}>← Back</button>
        <div>
          <h2 className="settings-screen__title">Settings</h2>
          <p className="settings-screen__subtitle">Profile, pitch, and Tutorial rules</p>
        </div>
      </div>

      <section className="settings-screen__section settings-screen__section--profile">
        <div className="settings-screen__section-heading">
          <div>
            <h3 className="settings-screen__section-title">Profile</h3>
            <p className="settings-screen__section-help">Your identity across leaderboards and reports.</p>
          </div>
        </div>
        <div className="settings-screen__profile-layout">
          <div className="settings-screen__avatar-column">
            <span className="settings-screen__avatar-preview" aria-hidden="true">
              <PlayerAvatar
                name={identityName}
                src={avatar}
                className="settings-screen__avatar-image"
                fallbackClassName="settings-screen__avatar-fallback"
              />
            </span>
            {isGuest ? (
              <p className="settings-screen__avatar-note">Sign in with Google to set an avatar.</p>
            ) : (
              <>
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
                    {avatarBusy ? 'Saving...' : 'Upload photo'}
                  </button>
                  {googleAvatarAvailable && (
                    <button
                      className="btn btn--secondary"
                      disabled={avatarBusy}
                      onClick={() => { void runAvatarChange(onUseGoogleAvatar, 'Google photo is now public.'); }}
                    >
                      Use Google photo
                    </button>
                  )}
                  {avatarIsLocalOnly && avatar && (
                    <button
                      className="btn btn--primary"
                      disabled={avatarBusy}
                      onClick={() => { void runAvatarChange(() => onAvatarUpload(avatar), 'Existing avatar is now public.'); }}
                    >
                      Publish current
                    </button>
                  )}
                  {avatar && (
                    <button
                      className="btn btn--ghost"
                      disabled={avatarBusy}
                      onClick={() => { void runAvatarChange(onRemoveAvatar, 'Avatar removed.'); }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="settings-screen__avatar-note">
                  {avatarIsLocalOnly
                    ? 'This existing picture is still private to this device until you publish it.'
                    : 'Your selected picture is public and appears beside your rankings.'}
                </p>
                {avatarNotice && <p className="settings-screen__success" role="status">{avatarNotice}</p>}
                {avatarError && <p className="settings-screen__error" role="alert">{avatarError}</p>}
              </>
            )}
          </div>
          <div className="settings-screen__identity-column">
            <label className="settings-screen__field-label" htmlFor="settings-display-name">Display name</label>
            <p className="settings-screen__section-help">
              This is the name shown on leaderboards and reports.
              {isGuest && ' Changing it starts a new personal best. The current best stays under the old name.'}
            </p>
            <div className="settings-screen__name-row">
              <input
                id="settings-display-name"
                className="settings-screen__name-input"
                type="text"
                maxLength={32}
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                aria-label="Display name"
              />
              <button className="btn btn--primary" disabled={!nameChanged} onClick={handleSaveName}>
                Save name
              </button>
            </div>
            <div className="settings-screen__profile-divider" />
            <label className="settings-screen__field-label" htmlFor="settings-country">Country / nationality</label>
            <p className="settings-screen__section-help">Optional. Shown publicly underneath your leaderboard name.</p>
            {isGuest ? (
              <p className="settings-screen__avatar-note">Sign in with Google to add this to your profile.</p>
            ) : (
              <>
                <div className="settings-screen__name-row">
                  <input
                    id="settings-country"
                    className="settings-screen__name-input"
                    type="text"
                    maxLength={64}
                    placeholder="e.g. England, UK, or British"
                    value={countryValue}
                    onChange={e => {
                      setCountryDraft({ source: country, value: e.target.value });
                      setCountrySaved(false);
                    }}
                    onKeyDown={e => e.key === 'Enter' && void saveCountry()}
                  />
                  <button className="btn btn--primary" disabled={!countryChanged || countryBusy} onClick={() => { void saveCountry(); }}>
                    {countryBusy ? 'Saving...' : 'Save country'}
                  </button>
                </div>
                {countrySaved && <p className="settings-screen__success" role="status">Profile updated.</p>}
                {countryError && <p className="settings-screen__error" role="alert">{countryError}</p>}
              </>
            )}
          </div>
        </div>
      </section>

      <section className="settings-screen__section">
        <div className="settings-screen__section-heading">
          <div>
            <h3 className="settings-screen__section-title">Pitch &amp; players</h3>
            <p className="settings-screen__section-help">Tune the board and how players appear on it.</p>
          </div>
        </div>
        <div className="settings-screen__control-group">
          <h4 className="settings-screen__group-title">Player tokens</h4>
          <p className="settings-screen__section-help">Choose the amount of detail shown during play.</p>
        </div>
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
              <span>Player portraits on a grass pitch</span>
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
              <span>Position symbols on a tactical grid</span>
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
              <span>Role codes on a plain pitch</span>
            </span>
          </button>
        </div>
        <div className="settings-screen__divider" />
        <div className="settings-screen__pitch-grid">
          <div className="settings-screen__control-group">
            <h4 className="settings-screen__group-title">Playing surface</h4>
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
          </div>
          <div className="settings-screen__control-group">
            <h4 className="settings-screen__group-title">Board size</h4>
            <p className="settings-screen__section-help">Large may need scrolling during play.</p>
            <div className="settings-screen__size-toggle" role="radiogroup" aria-label="Board size">
              <button
                type="button"
                role="radio"
                aria-checked={boardSize === 'small'}
                className={`settings-screen__size-option${boardSize === 'small' ? ' settings-screen__size-option--selected' : ''}`}
                onClick={() => onBoardSizeChange('small')}
              >
                <strong>Small</strong>
                <small>Compact</small>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={boardSize === 'medium'}
                className={`settings-screen__size-option${boardSize === 'medium' ? ' settings-screen__size-option--selected' : ''}`}
                onClick={() => onBoardSizeChange('medium')}
              >
                <strong>Medium</strong>
                <small>Default</small>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={boardSize === 'large'}
                className={`settings-screen__size-option${boardSize === 'large' ? ' settings-screen__size-option--selected' : ''}`}
                onClick={() => onBoardSizeChange('large')}
              >
                <strong>Large</strong>
                <small>Scrollable</small>
              </button>
            </div>
          </div>
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
        <div className="settings-screen__section-heading">
          <div>
            <h3 className="settings-screen__section-title">Tutorial</h3>
            <p className="settings-screen__section-help">Control help for the guided drills.</p>
          </div>
        </div>
        <label className="settings-screen__coordinate-toggle">
          <span>
            <strong>Tutorial guidance</strong>
            <small>
              Show the opening briefing and coach steps on every guided attempt.
              Turn this off to skip automatic guidance.
            </small>
          </span>
          <input
            type="checkbox"
            checked={showTutorialGuidance}
            onChange={event => onShowTutorialGuidanceChange(event.target.checked)}
          />
        </label>
      </section>

      {pendingRename !== null && (
        <ConfirmDialog
          title="Change display name?"
          message={`Your personal bests are tracked under "${identityName}". Renaming to "${pendingRename}" starts a new record. Scores under the old name remain on the board.`}
          confirmLabel="Change Name"
          cancelLabel="Keep Current Name"
          onConfirm={() => { commitRename(pendingRename); setPendingRename(null); }}
          onCancel={() => setPendingRename(null)}
        />
      )}
    </div>
  );
}
