export declare const LOGIN_LIMITS: {
  name: number;
};

export declare class LoginValidationError extends Error {}

export interface LoginUser {
  provider: string;
  providerUserId: string;
}

export interface LoginEntry {
  name: string;
  firstLoginAt: string;
  lastLoginAt: string;
  loginCount: number;
  userId?: string;
  authProvider?: string;
}

export declare function validateLoginPayload(body: unknown): { name: string };
export declare function recordLogin(
  entries: LoginEntry[],
  input: { name: string; user: LoginUser | null },
  now?: string,
): { entries: LoginEntry[]; entry: LoginEntry };
export declare function sortLogins(entries: LoginEntry[]): LoginEntry[];
