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
export class ReportConfigurationError extends Error {}
export class ReportDeliveryError extends Error {}

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

function escapeMarkdown(value) {
  return value
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

export function resolveReporterName(report, user) {
  return requiredText(user?.name ?? report.reporterName, 'reporterName', REPORT_LIMITS.reporterName);
}

export function buildIssueDraft(report, reporterName, submittedAt = new Date().toISOString()) {
  const category = report.type === 'feature' ? 'Feature request' : 'Issue';
  const titlePrefix = report.type === 'feature' ? '[Feature]' : '[Issue]';
  const issueTitle = report.title.replace(/\s+/g, ' ');
  const contextLines = [
    formatContext('Submitted', submittedAt),
    formatContext('App mode', report.context.mode),
    formatContext('Scenario', report.context.scenarioName),
    formatContext('Scenario ID', report.context.scenarioId),
    formatContext('Build', report.context.appVersion),
    formatContext('Browser', report.context.userAgent),
  ].filter(Boolean);

  return {
    title: `${titlePrefix} ${issueTitle}`,
    body: [
      '## Report details',
      '',
      `- Type: ${category}`,
      `- Reporter: ${escapeMarkdown(reporterName)}`,
      '',
      '## Description',
      '',
      escapeMarkdown(report.description),
      '',
      '## Context',
      '',
      ...contextLines,
    ].join('\n'),
  };
}

export function createDownload(report, reporterName) {
  const draft = buildIssueDraft(report, reporterName);
  const date = new Date().toISOString().slice(0, 10);
  return {
    fileName: `bbt-${report.type}-${date}.md`,
    content: `# ${draft.title}\n\n${draft.body}\n`,
  };
}

export async function createGitHubIssue(draft, { token = process.env.GITHUB_ISSUES_TOKEN, fetchImpl = fetch } = {}) {
  if (!token) throw new ReportConfigurationError('Issue reporting is not configured');

  let response;
  try {
    response = await fetchImpl('https://api.github.com/repos/HandsUpBilly/BBT/issues', {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ title: draft.title, body: draft.body }),
    });
  } catch {
    throw new ReportDeliveryError('Could not reach GitHub');
  }

  if (!response.ok) throw new ReportDeliveryError('GitHub could not create the issue');

  let issue;
  try {
    issue = await response.json();
  } catch {
    throw new ReportDeliveryError('GitHub returned an invalid response');
  }

  if (!Number.isInteger(issue?.number) || typeof issue?.html_url !== 'string') {
    throw new ReportDeliveryError('GitHub returned an incomplete issue response');
  }

  return { number: issue.number, url: issue.html_url };
}
