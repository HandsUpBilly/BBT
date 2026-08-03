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
}

export function summarizePerformance(entries: StatisticsEntry[] | undefined): PerformanceSummary;

export function buildPlayerStatistics(input: {
  scenarios: Array<{ id: string; name: string }>;
  scenarioBoards: Record<string, StatisticsEntry[] | undefined>;
  seriesEntries: StatisticsEntry[];
  generatedAt?: string;
}): PlayerStatistics;
