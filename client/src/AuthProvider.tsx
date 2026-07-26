import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { AuthContext, type AuthContextValue, type AuthUser } from './auth';

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

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
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);

  const signIn = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID) return;
    await loadGoogleScript();
    const googleId = window.google?.accounts?.id;
    if (!googleId) return;

    googleId.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: response => {
        if (!response.credential) return;
        const user = userFromCredential(response.credential);
        if (!user) return;
        setCurrentUser(user);
        setIdToken(response.credential);
      },
    });
    googleId.prompt();
  }, []);

  const signOut = useCallback(() => {
    window.google?.accounts?.id?.disableAutoSelect();
    setCurrentUser(null);
    setIdToken(null);
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
