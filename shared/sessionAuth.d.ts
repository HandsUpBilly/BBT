export class SessionAuthError extends Error {}
export interface AuthTokenPayload {
  sub: string;
  provider: 'google' | 'discord' | 'email';
  email?: string;
  picture?: string;
  purpose?: string;
  nonce?: string;
  iss?: string;
  aud?: string;
  iat?: number;
  exp?: number;
}
export function signAuthToken(payload: AuthTokenPayload, secret: string, options?: { lifetimeSeconds?: number; now?: number }): Promise<string>;
export function verifyAuthToken(token: string, secret: string, options?: { now?: number }): Promise<AuthTokenPayload>;
export function normalizeAuthEmail(value: unknown): string;
export function randomAuthToken(byteLength?: number): string;
export function hashAuthValue(value: string): Promise<string>;
export function providerUserId(provider: 'google' | 'discord' | 'email', subject: string): Promise<string>;
export function sessionUserFromPayload(payload: AuthTokenPayload): {
  provider: 'google' | 'discord' | 'email';
  providerUserId: string;
  email?: string;
  picture?: string;
};
