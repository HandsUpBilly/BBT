export const ANALYTICS_SCHEMA_VERSION: 1;
export const ANALYTICS_LIMITS: Readonly<Record<string, number>>;
export class AnalyticsValidationError extends Error {}
export interface AnalyticsEvent { type: string; at: string; data?: Record<string, unknown> }
export interface AnalyticsBatch {
  schemaVersion: 1; batchId: string; sessionId: string;
  sessionStartedAt: string; receivedAt: string;
  events: AnalyticsEvent[];
}
export interface AnalyticsSession {
  schemaVersion: 1; sessionId: string; startedAt: string; lastSeenAt: string;
  activeSeconds: number; attempts: Array<Record<string, any>>; seriesRuns: Array<Record<string, any>>;
  interactions: Record<string, number>; processedBatchIds: string[];
}
export function validateAnalyticsBatch(input: unknown, context?: Record<string, unknown>): AnalyticsBatch;
export function reduceAnalyticsBatch(existing: AnalyticsSession | null | undefined, batch: AnalyticsBatch): AnalyticsSession;
