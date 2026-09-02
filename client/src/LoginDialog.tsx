import { useEffect, useRef, useState } from 'react';
import { useModalFocus } from './useModalFocus';

interface Props {
  authConfigured: boolean;
  googleSignedIn: boolean;
  mountGoogleSignInButton: (container: HTMLElement) => Promise<void>;
  onAlias: (alias: string) => void;
  onClose: () => void;
}

export function LoginDialog({
  authConfigured,
  googleSignedIn,
  mountGoogleSignInButton,
  onAlias,
  onClose,
}: Props) {
  const [guestMode, setGuestMode] = useState(false);
  const [alias, setAlias] = useState('');
  const [googleSignInFailed, setGoogleSignInFailed] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const dialogRef = useModalFocus<HTMLDivElement>(onClose);
  const showAliasEntry = googleSignedIn || guestMode;

  useEffect(() => {
    const container = googleButtonRef.current;
    if (!authConfigured || !container || googleSignedIn || guestMode) return;
    let cancelled = false;

    void mountGoogleSignInButton(container).catch(() => {
      if (!cancelled) setGoogleSignInFailed(true);
    });

    return () => {
      cancelled = true;
      container.replaceChildren();
    };
  }, [authConfigured, googleSignedIn, guestMode, mountGoogleSignInButton]);

  function submitAlias() {
    const trimmed = alias.trim();
    if (trimmed) onAlias(trimmed);
  }

  return (
    <div
      className="identity-login"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="identity-login__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="identity-login-title"
        aria-describedby="identity-login-description"
        tabIndex={-1}
      >
        <button type="button" className="identity-login__close" onClick={onClose}>
          Close
        </button>

        {!showAliasEntry ? (
          <>
            <header className="identity-login__header">
              <span className="identity-login__kicker">Player access</span>
              <h2 id="identity-login-title">Choose how to play</h2>
              <p id="identity-login-description">
                Sign in to keep your profile and rankings across devices, or play as a guest on this device.
              </p>
            </header>

            <div className="identity-login__options">
              {authConfigured && !googleSignInFailed
                ? <div ref={googleButtonRef} className="identity-login__google-button" />
                : <button className="btn identity-login__option" disabled>Google login unavailable</button>}
              <div className="identity-login__divider"><span>or</span></div>
              <button
                type="button"
                className="btn btn--secondary identity-login__option"
                onClick={() => setGuestMode(true)}
              >
                Play as guest
              </button>
            </div>
          </>
        ) : (
          <>
            <header className="identity-login__header">
              <span className="identity-login__kicker">Public profile</span>
              <h2 id="identity-login-title">Choose your public alias</h2>
              <p id="identity-login-description">This is the name shown on leaderboards and reports.</p>
            </header>
            <div className="identity-login__alias">
              <label className="identity-login__label" htmlFor="player-alias">Player name</label>
              <input
                id="player-alias"
                className="identity-login__input"
                type="text"
                maxLength={32}
                placeholder="e.g. Endzone Expert"
                value={alias}
                onChange={event => setAlias(event.target.value)}
                onKeyDown={event => event.key === 'Enter' && submitAlias()}
                autoFocus
              />
              <button
                type="button"
                className="btn btn--primary identity-login__option"
                disabled={!alias.trim()}
                onClick={submitAlias}
              >
                Continue
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
