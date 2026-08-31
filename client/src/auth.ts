import { createContext, useContext } from 'react';

export interface GoogleCredentialPayload {
  sub?: string;
  name?: string;
  email?: string;
  picture?: string;
  /** Unix seconds. Google ID tokens are valid for roughly an hour. */
  exp?: number;
}

/** Reads a JWT's payload without verifying it — display only. The server
 * independently verifies the same token before trusting any of it. */
export function decodeJwtPayload(token: string): GoogleCredentialPayload {
  const [, payload] = token.split('.');
  if (!payload) return {};
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const binary = window.atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  // atob yields latin1 bytes; JWT payloads are UTF-8. Decoding them as one
  // byte per character mangles any non-ASCII display name (accents, CJK).
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as GoogleCredentialPayload;
}

/**
 * Google ID tokens expire after about an hour. The cached token used to be
 * sent forever, so a tab left open long enough started 401-ing on every score
 * submission with nothing shown to the player. Treat a token as expired a
 * little early to cover clock skew and request latency.
 */
const TOKEN_EXPIRY_SKEW_MS = 60_000;

export function isTokenExpired(token: string | null, now = Date.now()): boolean {
  if (!token) return true;
  // Anything that isn't shaped like a JWT is unusable, so don't send it.
  if (token.split('.').length !== 3) return true;
  try {
    const { exp } = decodeJwtPayload(token);
    if (!exp) return false; // no expiry claim — let the server be the judge
    return exp * 1000 - TOKEN_EXPIRY_SKEW_MS <= now;
  } catch {
    return true;
  }
}

export interface AuthUser {
  id: string;
  provider: 'google';
  email?: string;
  /** Offered as a public-avatar choice; never selected automatically. */
  picture?: string;
}

export interface AuthContextValue {
  currentUser: AuthUser | null;
  /** null once the cached Google token has expired — never send a dead token. */
  idToken: string | null;
  /** True when a Google user is still cached but their token has lapsed. */
  sessionExpired: boolean;
  isConfigured: boolean;
  /** Mounts Google's click-to-sign-in control into the supplied element. */
  mountSignInButton: (container: HTMLElement) => Promise<void>;
  signOut: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
