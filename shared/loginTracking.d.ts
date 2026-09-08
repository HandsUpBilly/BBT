export declare const LOGIN_LIMITS: {
  name: number;
};

export declare class LoginValidationError extends Error {}

export interface LoginUser {
  provider: string;
  providerUserId: string;
  email?: string;
}

export interface LoginEntry {
  name: string;
  firstLoginAt: string;
  lastLoginAt: string;
  loginCount: number;
  userId?: string;
  authProvider?: string;
  /** Private verified Google address; never returned by adminLoginEntries. */
  adminEmail?: string;
}

export interface AdminLoginEntry {
  name: string;
  firstLoginAt: string;
  lastLoginAt: string;
  loginCount: number;
  userId?: string;
  authProvider?: string;
  adminEligible: boolean;
  isManagedAdmin: boolean;
}

export declare function validateLoginPayload(body: unknown): { name: string };
export declare function recordLogin(
  entries: LoginEntry[],
  input: { name: string; user: LoginUser | null },
  now?: string,
): { entries: LoginEntry[]; entry: LoginEntry };
export declare function sortLogins(entries: LoginEntry[]): LoginEntry[];
export declare function loginAdminEmail(entries: LoginEntry[], userId: string): string | null;
export declare function adminLoginEntries(entries: LoginEntry[], managedAdmins?: string[]): AdminLoginEntry[];
