import { AuthError, authErrorResponse, verifyOptionalGoogleUser } from './auth.js';
import {
  ReportConfigurationError,
  ReportDeliveryError,
  ReportValidationError,
  buildIssueDraft,
  createDownload,
  createGitHubIssue,
  resolveReporterName,
  validateReportPayload,
} from '../../server/reporting.js';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let user = null;
  try {
    user = await verifyOptionalGoogleUser(req);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
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
    reporterName = resolveReporterName(report, user);
  } catch (error) {
    if (error instanceof ReportValidationError) return json({ error: error.message }, 400);
    throw error;
  }

  const draft = buildIssueDraft(report, reporterName);
  const download = createDownload(report, reporterName);
  try {
    const issue = await createGitHubIssue(draft);
    return json(issue, 201);
  } catch (error) {
    if (error instanceof ReportConfigurationError) return json({ error: error.message, download }, 503);
    if (error instanceof ReportDeliveryError) return json({ error: error.message, download }, 502);
    throw error;
  }
}
