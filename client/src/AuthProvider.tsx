import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AuthContext, decodeJwtPayload, isTokenExpired, type AuthContextValue, type AuthUser } from './auth';

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const AUTH_STORAGE_KEY = 'bbt.auth.v1';

interface StoredAuth { user: AuthUser; idToken: string }
interface SessionResponse { user: AuthUser; token: string }
interface GoogleCredentialResponse { credential?: string }
interface GoogleAccountsId {
  initialize(config: { client_id: string; callback: (response: GoogleCredentialResponse) => void }): void;
  renderButton(parent: HTMLElement, options: {
    theme: 'outline' | 'filled_blue' | 'filled_black';
    size: 'large' | 'medium' | 'small';
    text: 'signin_with';
    shape: 'rectangular';
    width?: number;
  }): void;
  disableAutoSelect(): void;
}

declare global {
  interface Window { google?: { accounts?: { id?: GoogleAccountsId } } }
}

let scriptPromise: Promise<void> | null = null;

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Google sign-in')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google sign-in'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

function userFromToken(token: string): AuthUser | null {
  try {
    const payload = decodeJwtPayload(token);
    if (!payload.sub) return null;
    const provider = payload.purpose === 'session' ? payload.provider : 'google';
    if (!provider || !['google', 'discord', 'email'].includes(provider)) return null;
    return {
      id: payload.sub,
      provider,
      ...(typeof payload.email === 'string' ? { email: payload.email } : {}),
      ...(typeof payload.picture === 'string' ? { picture: payload.picture } : {}),
    };
  } catch {
    return null;
  }
}

function loadStoredAuth(): StoredAuth | null {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredAuth> | null;
    if (!parsed?.idToken) return null;
    const user = userFromToken(parsed.idToken) ?? parsed.user;
    if (!user?.id || !['google', 'discord', 'email'].includes(user.provider)) return null;
    return { user, idToken: parsed.idToken };
  } catch {
    return null;
  }
}

function saveStoredAuth(user: AuthUser, idToken: string): void {
  try { window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user, idToken })); } catch { /* tab only */ }
}

function clearStoredAuth(): void {
  try { window.localStorage.removeItem(AUTH_STORAGE_KEY); } catch { /* ignore */ }
}

function readAuthFragment() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  return {
    sessionToken: params.get('auth'),
    magicToken: params.get('magic'),
    loginError: params.get('login_error'),
  };
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Login failed');
  return payload;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = useMemo(() => loadStoredAuth(), []);
  const incoming = useMemo(() => readAuthFragment(), []);
  const incomingUser = useMemo(
    () => incoming.sessionToken ? userFromToken(incoming.sessionToken) : null,
    [incoming.sessionToken],
  );
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(incomingUser ?? stored?.user ?? null);
  const [idToken, setIdToken] = useState<string | null>(() => {
    if (incoming.sessionToken && incomingUser && !isTokenExpired(incoming.sessionToken)) return incoming.sessionToken;
    return stored && !isTokenExpired(stored.idToken) ? stored.idToken : null;
  });
  const [providers, setProviders] = useState({ google: Boolean(GOOGLE_CLIENT_ID), discord: false, email: false });
  const [pendingMagicToken, setPendingMagicToken] = useState<string | null>(incoming.magicToken);
  const [authError, setAuthError] = useState<string | null>(
    incoming.loginError ?? (incoming.sessionToken && !incomingUser ? 'Login returned an invalid session' : null),
  );

  const applySession = useCallback((session: SessionResponse) => {
    const user = userFromToken(session.token) ?? session.user;
    if (!user?.id) throw new Error('Login returned an invalid session');
    setCurrentUser(user);
    setIdToken(session.token);
    setAuthError(null);
    saveStoredAuth(user, session.token);
  }, []);

  useEffect(() => {
    void fetch('/api/auth/config')
      .then(response => readJson(response))
      .then(config => setProviders({ google: config.google === true, discord: config.discord === true, email: config.email === true }))
      .catch(() => { /* retain client-configured Google fallback */ });
  }, []);

  useEffect(() => {
    if (incoming.sessionToken && incomingUser) saveStoredAuth(incomingUser, incoming.sessionToken);
    if (incoming.sessionToken || incoming.magicToken || incoming.loginError) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
  }, [incoming, incomingUser]);

  const exchangeGoogleCredential = useCallback(async (credential: string | undefined) => {
    if (!credential) return;
    try {
      const response = await fetch('/api/auth/google', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }),
      });
      applySession(await readJson(response) as unknown as SessionResponse);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Google login failed');
    }
  }, [applySession]);

  const mountSignInButton = useCallback(async (container: HTMLElement) => {
    if (!GOOGLE_CLIENT_ID || !providers.google) return;
    await loadGoogleScript();
    const googleId = window.google?.accounts?.id;
    if (!googleId) return;
    googleId.initialize({ client_id: GOOGLE_CLIENT_ID, callback: response => { void exchangeGoogleCredential(response.credential); } });
    container.replaceChildren();
    googleId.renderButton(container, {
      theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular',
      width: Math.max(220, Math.floor(container.getBoundingClientRect().width)),
    });
  }, [exchangeGoogleCredential, providers.google]);

  const startDiscordSignIn = useCallback(() => { window.location.assign('/api/auth/discord/start'); }, []);

  const sendMagicLink = useCallback(async (email: string) => {
    const response = await fetch('/api/auth/email/start', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
    });
    await readJson(response);
  }, []);

  const completeMagicLink = useCallback(async () => {
    if (!pendingMagicToken) throw new Error('Email login link is missing');
    const response = await fetch('/api/auth/email/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: pendingMagicToken }),
    });
    applySession(await readJson(response) as unknown as SessionResponse);
    setPendingMagicToken(null);
  }, [applySession, pendingMagicToken]);

  const signOut = useCallback(() => {
    window.google?.accounts?.id?.disableAutoSelect();
    setCurrentUser(null);
    setIdToken(null);
    clearStoredAuth();
  }, []);

  const tokenExpired = currentUser !== null && isTokenExpired(idToken);
  const value = useMemo<AuthContextValue>(() => ({
    currentUser,
    idToken: tokenExpired ? null : idToken,
    sessionExpired: tokenExpired,
    providers,
    mountSignInButton,
    startDiscordSignIn,
    sendMagicLink,
    completeMagicLink,
    pendingMagicLink: pendingMagicToken !== null,
    authError,
    clearAuthError: () => setAuthError(null),
    signOut,
  }), [currentUser, idToken, tokenExpired, providers, mountSignInButton, startDiscordSignIn, sendMagicLink, completeMagicLink, pendingMagicToken, authError, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
