import type { AnalyticsSession } from './analyticsValidation.js';
export interface EngagementAnalytics {
  generatedAt: string;
  windowDays: number;
  periodStart: string;
  periodEnd: string;
  overview: {
    gameSessions: number; engagedSessions: number;
    puzzleStarts: number; puzzleCompletions: number; completionRate: number | null;
    medianActiveSeconds: number | null; averagePuzzlesPerSession: number | null;
  };
  funnel: Array<{ stage: string; count: number }>;
  trend: Array<{ date: string; gameSessions: number; engagedSessions: number; starts: number; completions: number }>;
  activeTimeDistribution: Array<{ label: string; count: number }>;
  puzzlesPerSessionDistribution: Array<{ label: string; count: number }>;
  puzzles: Array<{
    scenarioId: string; scenarioName: string; starts: number; engaged: number; completions: number;
    restarts: number; explicitLeaves: number; inactive: number; completionRate: number | null;
    medianActiveSeconds: number | null; stopDepth: Record<string, number>; lastActions: Record<string, number>;
  }>;
  seriesFunnel: {
    starts: number; stages: Array<{ position: number; scenarioId: string; completions: number }>;
    completions: number; outcomes: Record<string, number>;
  };
  actions: Array<{ name: string; count: number; perEngagedAttempt: number | null }>;
  outcomes: Array<{ name: string; count: number }>;
  interactions: Array<{ name: string; count: number }>;
}
export function buildEngagementAnalytics(input: {
  sessions: AnalyticsSession[]; generatedAt?: string; windowDays?: number;
}): EngagementAnalytics;
