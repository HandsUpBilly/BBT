import type { Scenario, ScenarioPieceDef, SeriesDefinition } from '../client/src/types';

export declare const SCENARIO_ID_RE: RegExp;
export declare const PITCH: { maxCol: number; maxRow: number };
export declare const STAT_RANGE: { min: number; max: number };
export declare const STAT_KEYS: readonly ('ma' | 'st' | 'ag' | 'pa' | 'av')[];
export declare const TEAMS: readonly ('human' | 'orc')[];

export declare function normalizeScenario(input: unknown): Scenario & { pieces: ScenarioPieceDef[] };
export declare function normalizeSeries(input: unknown): SeriesDefinition;

export interface ValidateScenarioOptions {
  /** Skip the "id already exists" check entirely (server-side updates). */
  allowExisting?: boolean;
  /** Id currently being edited — exempt from the uniqueness check. */
  currentId?: string;
}

export declare function validateScenario(
  scenario: Scenario,
  existingIds?: Set<string> | string[],
  options?: ValidateScenarioOptions,
): string[];

export declare function missingSeriesScenarioIds(
  series: SeriesDefinition | null | undefined,
  scenarios: readonly Scenario[] | null | undefined,
): string[];
