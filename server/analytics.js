import {
  AnalyticsValidationError,
  reduceAnalyticsBatch,
  validateAnalyticsBatch,
} from '../shared/analyticsValidation.js';
import { buildEngagementAnalytics } from '../shared/analyticsStatistics.js';
import { ANALYTICS_RATE_LIMIT, createRateLimiter, rateLimitKey } from '../shared/rateLimit.js';
import { AdminAuthError, requireAdminGoogleUser } from './auth.js';

const sessions = new Map();
const takeAnalyticsToken = createRateLimiter(ANALYTICS_RATE_LIMIT);

function windowDays(value) {
  const days = Number(value);
  return [7, 30, 90, 365].includes(days) ? days : 30;
}

export function registerAnalyticsRoutes(app) {
  app.post('/api/analytics', (req, res) => {
    if (!req.is('application/json')) return res.status(415).json({ error: 'Content-Type must be application/json' });
    if (Buffer.byteLength(JSON.stringify(req.body)) > 64 * 1024) return res.status(413).json({ error: 'Analytics batch is too large' });
    const limit = takeAnalyticsToken(rateLimitKey({ remoteAddress: req.ip }));
    if (!limit.allowed) {
      res.set('Retry-After', String(limit.retryAfterSeconds));
      return res.status(429).json({ error: 'Too many analytics requests' });
    }
    try {
      const batch = validateAnalyticsBatch(req.body, {
        receivedAt: new Date().toISOString(),
      });
      sessions.set(batch.sessionId, reduceAnalyticsBatch(sessions.get(batch.sessionId), batch));
      return res.status(202).json({ accepted: true });
    } catch (error) {
      if (error instanceof AnalyticsValidationError) return res.status(400).json({ error: error.message });
      throw error;
    }
  });

  app.get('/api/editor/analytics', async (req, res) => {
    try {
      await requireAdminGoogleUser(req);
    } catch (error) {
      if (error instanceof AdminAuthError) return res.status(error.status).json({ error: error.message });
      throw error;
    }
    return res.json(buildEngagementAnalytics({
      sessions: [...sessions.values()],
      windowDays: windowDays(req.query.window),
    }));
  });
}
