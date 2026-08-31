import { SCENARIO_ID_RE } from './scenarioValidation.js';

export const RANKING_RESET_SCOPES = Object.freeze(['all', 'series', 'puzzle']);

export class RankingResetValidationError extends Error {}

/** Keeps the Express and Netlify destructive endpoints on the same contract. */
export function parseRankingResetTarget(scopeValue, idValue) {
  const scope = typeof scopeValue === 'string' ? scopeValue.trim() : '';
  if (!RANKING_RESET_SCOPES.includes(scope)) {
    throw new RankingResetValidationError('Choose all rankings, one series, or one puzzle');
  }
  if (scope === 'all') return { scope };

  const id = typeof idValue === 'string' ? idValue.trim() : '';
  if (!SCENARIO_ID_RE.test(id)) {
    throw new RankingResetValidationError(`A valid ${scope} id is required`);
  }
  return { scope, id };
}
