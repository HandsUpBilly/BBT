import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { AuthContext, decodeJwtPayload, isTokenExpired, type AuthContextValue, type AuthUser } from './auth';

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const AUTH_STORAGE_KEY = 'bbt.auth.v1';

interface StoredAuth {
  user: AuthUser;
  idToken: string;
}

function loadStoredAuth(): StoredAuth | null {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredAuth> | null;
    if (!parsed?.user?.id || parsed.user.provider !== 'google' || !parsed.idToken) return null;
    const payload = decodeJwtPayload(parsed.idToken);
    return {
      user: {
        id: parsed.user.id,
        provider: 'google',
        ...(typeof parsed.user.email === 'string'
          ? { email: parsed.user.email }
          : typeof payload.email === 'string' ? { email: payload.email } : {}),
        ...(typeof parsed.user.picture === 'string'
          ? { picture: parsed.user.picture }
          : typeof payload.picture === 'string' ? { picture: payload.picture } : {}),
      },
      idToken: parsed.idToken,
    };
  } catch {
    return null;
  }
}

function saveStoredAuth(user: AuthUser, idToken: string): void {
  try {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user, idToken }));
  } catch {
    // Storage unavailable (private browsing, quota) — session just won't persist.
  }
}

function clearStoredAuth(): void {
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Ignore.
  }
}

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleAccountsId {
  initialize(config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }): void;
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
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsId;
      };
    };
  }
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

function userFromCredential(credential: string): AuthUser | null {
  try {
    const payload = decodeJwtPayload(credential);
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      provider: 'google',
      email: payload.email,
      picture: payload.picture,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = useMemo(() => loadStoredAuth(), []);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(stored?.user ?? null);
  // Keep the cached user (so the identity gate stays satisfied and the player
  // isn't kicked back to the login screen) but drop an expired token, since
  // sending it would 401 every write. sessionExpired then drives the
  // "sign in again" banner (see App.tsx) for an interactive re-login.
  const [idToken, setIdToken] = useState<string | null>(
    stored && !isTokenExpired(stored.idToken) ? stored.idToken : null,
  );

  const applyCredential = useCallback((credential: string | undefined) => {
    if (!credential) return;
    const user = userFromCredential(credential);
    if (!user) return;
    setCurrentUser(user);
    setIdToken(credential);
    saveStoredAuth(user, credential);
  }, []);

  const mountSignInButton = useCallback(async (container: HTMLElement) => {
    if (!GOOGLE_CLIENT_ID) return;
    await loadGoogleScript();
    const googleId = window.google?.accounts?.id;
    if (!googleId) return;

    googleId.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: response => applyCredential(response.credential),
    });
    container.replaceChildren();
    googleId.renderButton(container, {
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
      width: Math.max(220, Math.floor(container.getBoundingClientRect().width)),
    });
  }, [applyCredential]);

  const signOut = useCallback(() => {
    window.google?.accounts?.id?.disableAutoSelect();
    setCurrentUser(null);
    setIdToken(null);
    clearStoredAuth();
  }, []);

  // Re-check on every render rather than caching: a tab can sit open past the
  // token's lifetime without any state change to trigger a recompute.
  const tokenExpired = currentUser !== null && isTokenExpired(idToken);

  const value = useMemo<AuthContextValue>(() => ({
    currentUser,
    idToken: tokenExpired ? null : idToken,
    sessionExpired: tokenExpired,
    isConfigured: Boolean(GOOGLE_CLIENT_ID),
    mountSignInButton,
    signOut,
  }), [currentUser, idToken, tokenExpired, mountSignInButton, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
