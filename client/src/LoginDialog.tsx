import { useEffect, useRef, useState } from 'react';
import { useModalFocus } from './useModalFocus';

interface Props {
  providers: { google: boolean; discord: boolean; email: boolean };
  signedIn: boolean;
  pendingMagicLink: boolean;
  authError: string | null;
  mountGoogleSignInButton: (container: HTMLElement) => Promise<void>;
  onDiscord: () => void;
  onSendMagicLink: (email: string) => Promise<void>;
  onCompleteMagicLink: () => Promise<void>;
  onClearAuthError: () => void;
  onAlias: (alias: string) => void;
  onClose: () => void;
}

export function LoginDialog({
  providers,
  signedIn,
  pendingMagicLink,
  authError,
  mountGoogleSignInButton,
  onDiscord,
  onSendMagicLink,
  onCompleteMagicLink,
  onClearAuthError,
  onAlias,
  onClose,
}: Props) {
  const [guestMode, setGuestMode] = useState(false);
  const [alias, setAlias] = useState('');
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [working, setWorking] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [googleSignInFailed, setGoogleSignInFailed] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const dialogRef = useModalFocus<HTMLDivElement>(onClose);
  const showAliasEntry = signedIn || guestMode;
  const error = localError ?? authError;

  useEffect(() => {
    const container = googleButtonRef.current;
    if (!providers.google || !container || signedIn || guestMode || pendingMagicLink) return;
    let cancelled = false;
    void mountGoogleSignInButton(container).catch(() => {
      if (!cancelled) setGoogleSignInFailed(true);
    });
    return () => {
      cancelled = true;
      container.replaceChildren();
    };
  }, [providers.google, signedIn, guestMode, pendingMagicLink, mountGoogleSignInButton]);

  function submitAlias() {
    const trimmed = alias.trim();
    if (trimmed) onAlias(trimmed);
  }

  async function sendEmail() {
    if (!email.trim()) return;
    setWorking(true);
    setLocalError(null);
    onClearAuthError();
    try {
      await onSendMagicLink(email);
      setEmailSent(true);
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : 'Could not send the login email');
    } finally {
      setWorking(false);
    }
  }

  async function finishEmailLogin() {
    setWorking(true);
    setLocalError(null);
    onClearAuthError();
    try {
      await onCompleteMagicLink();
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : 'Could not finish email login');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="identity-login" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div
        ref={dialogRef}
        className="identity-login__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="identity-login-title"
        aria-describedby="identity-login-description"
        tabIndex={-1}
      >
        <button type="button" className="identity-login__close" onClick={onClose}>Close</button>

        {pendingMagicLink && !signedIn ? (
          <>
            <header className="identity-login__header">
              <span className="identity-login__kicker">Secure hand-off</span>
              <h2 id="identity-login-title">Finish email login</h2>
              <p id="identity-login-description">Confirm this request to use the one-time link. It will stop working immediately afterwards.</p>
            </header>
            <div className="identity-login__options">
              {error && <p className="identity-login__error" role="alert">{error}</p>}
              <button type="button" className="btn btn--primary identity-login__option" disabled={working} onClick={() => { void finishEmailLogin(); }}>
                {working ? 'Checking link…' : 'Continue to Turn 16'}
              </button>
            </div>
          </>
        ) : !showAliasEntry ? (
          <>
            <header className="identity-login__header">
              <span className="identity-login__kicker">Player access</span>
              <h2 id="identity-login-title">Choose how to play</h2>
              <p id="identity-login-description">Sign in to keep your profile and rankings across devices, or play as a guest on this device.</p>
            </header>

            <div className="identity-login__options">
              {error && <p className="identity-login__error" role="alert">{error}</p>}
              {providers.google && !googleSignInFailed && <div ref={googleButtonRef} className="identity-login__google-button" />}
              {providers.discord && (
                <button type="button" className="btn identity-login__option identity-login__discord" onClick={onDiscord}>
                  <svg className="identity-login__discord-mark" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7.2 7.6A15 15 0 0 1 10 6.8l.4.8a10 10 0 0 1 3.2 0l.4-.8a15 15 0 0 1 2.8.8c1.8 2.6 2.3 5.1 2 7.6a11 11 0 0 1-3.5 1.8l-.8-1.1c.5-.2 1-.5 1.4-.8a9 9 0 0 1-7.8 0c.4.3.9.6 1.4.8L8.7 17a11 11 0 0 1-3.5-1.8c-.3-2.5.2-5 2-7.6Z" />
                    <circle cx="9.4" cy="12.2" r="1.15" />
                    <circle cx="14.6" cy="12.2" r="1.15" />
                  </svg>
                  Continue with Discord
                </button>
              )}
              {providers.email && (
                emailSent ? (
                  <div className="identity-login__sent" role="status">
                    <strong>Check your inbox</strong>
                    <span>The link expires in 15 minutes. You can close this dialog.</span>
                  </div>
                ) : (
                  <div className="identity-login__email">
                    <label className="identity-login__label" htmlFor="login-email">Email address</label>
                    <div className="identity-login__email-row">
                      <input
                        id="login-email"
                        className="identity-login__input"
                        type="email"
                        autoComplete="email"
                        placeholder="coach@example.com"
                        value={email}
                        onChange={event => setEmail(event.target.value)}
                        onKeyDown={event => { if (event.key === 'Enter') void sendEmail(); }}
                      />
                      <button type="button" className="btn btn--secondary" disabled={working || !email.trim()} onClick={() => { void sendEmail(); }}>
                        {working ? 'Sending…' : 'Email link'}
                      </button>
                    </div>
                  </div>
                )
              )}
              <div className="identity-login__divider"><span>or</span></div>
              <button type="button" className="btn btn--secondary identity-login__option" onClick={() => setGuestMode(true)}>Play as guest</button>
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
              <button type="button" className="btn btn--primary identity-login__option" disabled={!alias.trim()} onClick={submitAlias}>Continue</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
