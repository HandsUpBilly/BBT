export interface StatisticsEntry {
  probability: number;
  diceCount: number;
  date?: string;
  name?: string;
  userId?: string;
}

export interface PerformanceSummary {
  recordedPlayers: number;
  personalBests: number;
  averageProbability: number | null;
  medianProbability: number | null;
  bestProbability: number | null;
  averageDiceCount: number | null;
  latestScoreAt: string | null;
}

export interface PuzzlePerformanceSummary extends PerformanceSummary {
  scenarioId: string;
  scenarioName: string;
}

export interface PlayerStatistics {
  generatedAt: string;
  windowDays: number | null;
  totals: {
    recordedPlayers: number;
    puzzlePersonalBests: number;
    seriesPersonalBests: number;
    averageProbability: number | null;
    medianProbability: number | null;
    averageDiceCount: number | null;
  };
  puzzles: PuzzlePerformanceSummary[];
  series: PerformanceSummary;
  habits: {
    signedInPlayers: number;
    guestPlayers: number;
    returningPlayers: number;
    averagePuzzlesPerPlayer: number | null;
    activePlayers7Days: number;
    activePlayers30Days: number;
    onePuzzlePlayers: number;
    threePlusPuzzlePlayers: number;
    actionCounts: Record<'dodge' | 'gfi' | 'pickup' | 'catch' | 'pass' | 'block' | 'blitz', number>;
  };
}

export function summarizePerformance(entries: StatisticsEntry[] | undefined): PerformanceSummary;

export function buildPlayerStatistics(input: {
  scenarios: Array<{ id: string; name: string }>;
  scenarioBoards: Record<string, StatisticsEntry[] | undefined>;
  seriesEntries: StatisticsEntry[];
  generatedAt?: string;
  windowDays?: number;
}): PlayerStatistics;
