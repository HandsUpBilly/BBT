import { AuthError, verifyOptionalGoogleUser } from './auth.js';
import {
  ReportValidationError,
  buildIssueDraft,
  createDownload,
  resolveReporterName,
  validateReportPayload,
} from '../../shared/reporting.js';
import {
  ReportConfigurationError,
  ReportDeliveryError,
  createGitHubIssue,
} from '../../shared/githubIssues.js';
import { REPORT_RATE_LIMIT, createRateLimiter } from '../../shared/rateLimit.js';

// Per-instance limiter. Netlify recycles function instances, so this throttles a
// burst from one attacker rather than guaranteeing a global cap — see
// shared/rateLimit.js for why that trade-off is acceptable here.
const takeReportToken = createRateLimiter(REPORT_RATE_LIMIT);

function json(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function clientKey(req, user) {
  if (user?.providerUserId) return user.providerUserId;
  const forwarded = req.headers.get('x-nf-client-connection-ip')
    ?? req.headers.get('x-forwarded-for')
    ?? '';
  return forwarded.split(',')[0].trim() || 'unknown';
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let user = null;
  try {
    user = await verifyOptionalGoogleUser(req);
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
    // A present-but-unverifiable token (e.g. expired after the tab sat idle)
    // shouldn't block a report — the reporter name the form always collects
    // is enough to file one. Degrade to the guest path instead of rejecting.
    user = null;
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  let report;
  let reporterName;
  try {
    report = validateReportPayload(payload);
    reporterName = resolveReporterName(report);
  } catch (error) {
    if (error instanceof ReportValidationError) return json({ error: error.message }, 400);
    throw error;
  }

  const draft = buildIssueDraft(report, reporterName);
  const download = createDownload(report, reporterName);

  // Rate-limit after validation so malformed spam can't burn a caller's budget.
  const { allowed, retryAfterSeconds } = takeReportToken(clientKey(req, user));
  if (!allowed) {
    return json(
      {
        error: 'Too many reports from this session. Try again later, or download the report below.',
        download,
      },
      429,
      { 'Retry-After': String(retryAfterSeconds) },
    );
  }

  try {
    const issue = await createGitHubIssue(draft);
    return json(issue, 201);
  } catch (error) {
    if (error instanceof ReportConfigurationError) return json({ error: error.message, download }, 503);
    if (error instanceof ReportDeliveryError) return json({ error: error.message, download }, 502);
    throw error;
  }
}
