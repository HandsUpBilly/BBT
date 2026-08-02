import type { Scenario } from '../types';
// The same rules the server enforces. Previously this file reimplemented a
// looser subset (no stat ranges, no team checks), so the editor could show a
// clean validation list for a draft the server then rejected with a 400.
import {
  normalizeScenario,
  validateScenario,
  missingSeriesScenarioIds,
} from '../../../shared/scenarioValidation.js';

export { missingSeriesScenarioIds };

/**
 * Validates the in-progress draft exactly as the server will.
 *
 * @param originalId the id being edited, exempt from the uniqueness check
 */
export function validateScenarioDraft(
  scenario: Scenario,
  existingIds: string[],
  originalId?: string,
): string[] {
  return validateScenario(normalizeScenario(scenario), existingIds, { currentId: originalId });
}

export function nextScenarioId(existingIds: string[]): string {
  let index = existingIds.length + 1;
  let id = `scenario-${String(index).padStart(3, '0')}`;
  while (existingIds.includes(id)) {
    index += 1;
    id = `scenario-${String(index).padStart(3, '0')}`;
  }
  return id;
}
