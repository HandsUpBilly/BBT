import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AuthContext, type AuthContextValue, type AuthUser } from './auth';

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
    if (!parsed?.user?.id || !parsed.idToken) return null;
    return { user: parsed.user, idToken: parsed.idToken };
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

interface GoogleCredentialPayload {
  sub?: string;
  name?: string;
  email?: string;
  picture?: string;
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
  prompt(): void;
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

function decodeJwtPayload(token: string): GoogleCredentialPayload {
  const [, payload] = token.split('.');
  if (!payload) return {};
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const json = window.atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return JSON.parse(json) as GoogleCredentialPayload;
}

function userFromCredential(credential: string): AuthUser | null {
  try {
    const payload = decodeJwtPayload(credential);
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      provider: 'google',
      displayName: payload.name || payload.email || 'Google Player',
      email: payload.email,
      avatarUrl: payload.picture,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = useMemo(() => loadStoredAuth(), []);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(stored?.user ?? null);
  const [idToken, setIdToken] = useState<string | null>(stored?.idToken ?? null);

  const applyCredential = useCallback((credential: string | undefined) => {
    if (!credential) return;
    const user = userFromCredential(credential);
    if (!user) return;
    setCurrentUser(user);
    setIdToken(credential);
    saveStoredAuth(user, credential);
  }, []);

  const signIn = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID) return;
    await loadGoogleScript();
    const googleId = window.google?.accounts?.id;
    if (!googleId) return;

    googleId.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: response => applyCredential(response.credential),
    });
    googleId.prompt();
  }, [applyCredential]);

  const signOut = useCallback(() => {
    window.google?.accounts?.id?.disableAutoSelect();
    setCurrentUser(null);
    setIdToken(null);
    clearStoredAuth();
  }, []);

  // On load, if we have a previously signed-in Google user, try a silent
  // (no-prompt) re-auth to refresh the id token. If Google can't silently
  // re-authenticate (e.g. third-party cookies blocked), we keep the cached
  // user/token from localStorage so the session still persists across a
  // refresh instead of forcing a fresh login every time.
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !stored) return;
    let cancelled = false;
    void (async () => {
      try {
        await loadGoogleScript();
        if (cancelled) return;
        const googleId = window.google?.accounts?.id;
        if (!googleId) return;
        googleId.initialize({
          client_id: GOOGLE_CLIENT_ID,
          auto_select: true,
          cancel_on_tap_outside: false,
          callback: response => applyCredential(response.credential),
        });
        googleId.prompt();
      } catch {
        // Silent re-auth failed — fall back to the cached session.
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    currentUser,
    idToken,
    isConfigured: Boolean(GOOGLE_CLIENT_ID),
    signIn,
    signOut,
  }), [currentUser, idToken, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
