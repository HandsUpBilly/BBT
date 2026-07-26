import { createContext, useContext } from 'react';

export interface AuthUser {
  id: string;
  provider: 'google';
  displayName: string;
  email?: string;
  avatarUrl?: string;
}

export interface AuthContextValue {
  currentUser: AuthUser | null;
  idToken: string | null;
  isConfigured: boolean;
  signIn: () => Promise<void>;
  signOut: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
