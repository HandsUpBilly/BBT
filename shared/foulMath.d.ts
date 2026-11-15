export interface FoulOddsInput {
  /** Stored armour value, printed target minus one. */
  av: number;
  offensiveAssists?: number;
  defensiveAssists?: number;
  dirtyPlayer?: boolean;
  sneakyGit?: boolean;
  loneFouler?: boolean;
  stunty?: boolean;
}

export interface FoulOdds {
  armourBreakProbability: number;
  injuryProbability: number;
  sentOffProbability: number;
  injuryAndSentOffProbability: number;
  noInjuryProbability: number;
}

export declare function foulOdds(input: FoulOddsInput): FoulOdds;
