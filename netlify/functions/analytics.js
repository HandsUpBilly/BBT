import {
  AnalyticsValidationError,
  validateAnalyticsBatch,
} from '../../shared/analyticsValidation.js';
import { ANALYTICS_RATE_LIMIT, createRateLimiter, rateLimitKey } from '../../shared/rateLimit.js';
import { analyticsSessionStore, mergeAnalyticsBatch } from './analyticsStore.js';

const takeAnalyticsToken = createRateLimiter(ANALYTICS_RATE_LIMIT);

function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export default async function handler(req) {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return json(415, { error: 'Content-Type must be application/json' });
  }
  const contentLength = Number(req.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > 64 * 1024) return json(413, { error: 'Analytics batch is too large' });
  const limit = takeAnalyticsToken(rateLimitKey({ getHeader: name => req.headers.get(name) }));
  if (!limit.allowed) return json(429, { error: 'Too many analytics requests' }, { 'Retry-After': String(limit.retryAfterSeconds) });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }
  try {
    const batch = validateAnalyticsBatch(body, {
      receivedAt: new Date().toISOString(),
    });
    await mergeAnalyticsBatch(analyticsSessionStore(), batch);
    return json(202, { accepted: true });
  } catch (error) {
    if (error instanceof AnalyticsValidationError) return json(400, { error: error.message });
    return json(503, { error: 'Could not save analytics' });
  }
}
