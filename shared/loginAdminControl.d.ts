import type { LoginEntry } from './loginTracking';

export interface LoginAdminUpdateRequest {
  entries: LoginEntry[];
  userId: string | null | undefined;
  adding: boolean;
  current: string[];
  configuredAdminCount: number;
}

export type LoginAdminUpdatePlan =
  | { ok: true; target: string; managedAdmins: string[] }
  | { ok: false; status: number; errors: string[] };

export declare function planLoginAdminUpdate(
  request: LoginAdminUpdateRequest,
): LoginAdminUpdatePlan;
