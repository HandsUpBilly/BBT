// Isomorphic report validation + Markdown generation.
//
// Deliberately free of any Node/browser API so the client's "Download report"
// fallback produces byte-identical Markdown to the issue the server would have
// filed — spec.md requires the two to match. Anything needing `process.env` or
// network access lives in githubIssues.js (server-only).

export const REPORT_LIMITS = {
  reporterName: 64,
  title: 120,
  description: 4000,
  mode: 32,
  scenarioId: 80,
  scenarioName: 160,
  appVersion: 80,
  userAgent: 300,
};

const REPORT_TYPES = new Set(['issue', 'feature']);

export class ReportValidationError extends Error {}

function requiredText(value, field, maxLength) {
  if (typeof value !== 'string') throw new ReportValidationError(`${field} is required`);
  const trimmed = value.trim();
  if (!trimmed) throw new ReportValidationError(`${field} is required`);
  if (trimmed.length > maxLength) throw new ReportValidationError(`${field} is too long`);
  return trimmed;
}

function optionalText(value, maxLength) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

/** Neutralizes Markdown so untrusted report text can never inject formatting. */
export function escapeMarkdown(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/([`*_{}[\]<>#+!|-])/g, '\\$1');
}

function formatContext(label, value) {
  return value ? `- ${label}: ${escapeMarkdown(value)}` : null;
}

export function validateReportPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ReportValidationError('Invalid report payload');
  }

  if (!REPORT_TYPES.has(payload.type)) {
    throw new ReportValidationError('type must be issue or feature');
  }

  const context = payload.context && typeof payload.context === 'object' && !Array.isArray(payload.context)
    ? payload.context
    : {};

  return {
    type: payload.type,
    title: requiredText(payload.title, 'title', REPORT_LIMITS.title),
    description: requiredText(payload.description, 'description', REPORT_LIMITS.description),
    reporterName: optionalText(payload.reporterName, REPORT_LIMITS.reporterName),
    context: {
      mode: optionalText(context.mode, REPORT_LIMITS.mode),
      scenarioId: optionalText(context.scenarioId, REPORT_LIMITS.scenarioId),
      scenarioName: optionalText(context.scenarioName, REPORT_LIMITS.scenarioName),
      appVersion: optionalText(context.appVersion, REPORT_LIMITS.appVersion),
      userAgent: optionalText(context.userAgent, REPORT_LIMITS.userAgent),
    },
  };
}

/** Reports identify the player by their chosen public alias, not a Google profile name. */
export function resolveReporterName(report) {
  return requiredText(report.reporterName, 'reporterName', REPORT_LIMITS.reporterName);
}

export function buildIssueDraft(report, reporterName, submittedAt = new Date().toISOString()) {
  const category = report.type === 'feature' ? 'Feature request' : 'Issue';
  const titlePrefix = report.type === 'feature' ? '[Feature]' : '[Issue]';
  const issueTitle = report.title.trim().replace(/\s+/g, ' ');
  const contextLines = [
    formatContext('Submitted', submittedAt),
    formatContext('App mode', report.context?.mode),
    formatContext('Scenario', report.context?.scenarioName),
    formatContext('Scenario ID', report.context?.scenarioId),
    formatContext('Build', report.context?.appVersion),
    formatContext('Browser', report.context?.userAgent),
  ].filter(Boolean);

  return {
    title: `${titlePrefix} ${issueTitle}`,
    body: [
      '## Report details',
      '',
      `- Type: ${category}`,
      `- Reporter: ${escapeMarkdown(reporterName.trim())}`,
      '',
      '## Description',
      '',
      escapeMarkdown(report.description.trim()),
      '',
      '## Context',
      '',
      ...contextLines,
    ].join('\n'),
  };
}

export function createDownload(report, reporterName, submittedAt = new Date().toISOString()) {
  const draft = buildIssueDraft(report, reporterName, submittedAt);
  return {
    fileName: `bbt-${report.type}-${submittedAt.slice(0, 10)}.md`,
    content: `# ${draft.title}\n\n${draft.body}\n`,
  };
}
