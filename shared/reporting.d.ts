export declare const REPORT_LIMITS: {
  reporterName: number;
  title: number;
  description: number;
  mode: number;
  scenarioId: number;
  scenarioName: number;
  appVersion: number;
  userAgent: number;
};

export declare class ReportValidationError extends Error {}

export interface ReportContextFields {
  mode?: string;
  scenarioId?: string;
  scenarioName?: string;
  appVersion?: string;
  userAgent?: string;
}

export interface ValidatedReport {
  type: 'issue' | 'feature';
  title: string;
  description: string;
  reporterName?: string;
  context: ReportContextFields;
}

export interface IssueDraft {
  title: string;
  body: string;
}

export interface ReportDownloadFile {
  fileName: string;
  content: string;
}

export declare function escapeMarkdown(value: string): string;
export declare function validateReportPayload(payload: unknown): ValidatedReport;
export declare function resolveReporterName(
  report: ValidatedReport,
  user?: { name?: string } | null,
): string;
export declare function buildIssueDraft(
  report: ValidatedReport,
  reporterName: string,
  submittedAt?: string,
): IssueDraft;
export declare function createDownload(
  report: ValidatedReport,
  reporterName: string,
  submittedAt?: string,
): ReportDownloadFile;
