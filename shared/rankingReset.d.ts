export const RANKING_RESET_SCOPES: readonly ['all', 'series', 'puzzle'];
export type RankingResetTarget =
  | { scope: 'all' }
  | { scope: 'series' | 'puzzle'; id: string };
export class RankingResetValidationError extends Error {}
export function parseRankingResetTarget(scopeValue: unknown, idValue: unknown): RankingResetTarget;
