// Minimal fixed-window rate limiter shared by both report endpoints.
//
// State is per-process and in-memory. On Express that is a real limit; on
// Netlify Functions it only holds for as long as an instance stays warm, so it
// throttles a single attacker's burst but is not a hard guarantee. That is the
// intended trade-off for now: it removes the "hold Enter and file 200 GitHub
// issues" hole without adding a datastore dependency. Move to a Blobs- or
// KV-backed counter if abuse actually materializes.

/**
 * Which caller is this, for throttling purposes?
 *
 * This lived as four hand-copied definitions — three byte-identical ones in the
 * Netlify functions and an inline `req.ip` variant repeated three times in
 * Express — which had already drifted in form. It governs a security control,
 * so a future tightening applied to one copy and not the others would leave the
 * other endpoints bypassable while the code read as if they were fixed.
 *
 * The two targets identify a caller differently, so each passes what it has:
 *
 *   - Netlify sets `x-nf-client-connection-ip` on every request; it is set by
 *     the edge, not the client, so it cannot be forged.
 *   - Express has no such header. Its trusted answer is `req.ip`, which already
 *     accounts for the app's `trust proxy` setting — a header adapter cannot
 *     reach it, which is why `remoteAddress` is a separate parameter.
 *
 * `x-forwarded-for` is deliberately NOT consulted. It is client-supplied, so an
 * attacker rotating it would mint a fresh bucket per request and turn the
 * limiter into a no-op — strictly worse than the shared 'unknown' bucket, which
 * at least throttles. Neither target should ever reach that fallback.
 *
 * @param options.user           verified user, or null for a guest
 * @param options.getHeader      `(name) => string | null`, as in googleAuth.js
 * @param options.remoteAddress  a trusted peer address, when the target has one
 */
export function rateLimitKey({ user, getHeader = () => null, remoteAddress = null } = {}) {
  if (user?.providerUserId) return `user:${user.providerUserId}`;

  const address =
    trimmedOrNull(getHeader('x-nf-client-connection-ip')) ?? trimmedOrNull(remoteAddress);

  return address ? `ip:${address}` : 'unknown';
}

function trimmedOrNull(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function createRateLimiter({ limit, windowMs, now = () => Date.now() }) {
  const hits = new Map();

  function sweep(currentTime) {
    for (const [bucketKey, bucket] of hits) {
      if (bucket.resetAt <= currentTime) hits.delete(bucketKey);
    }
  }

  /**
   * @returns {{ allowed: boolean, remaining: number, retryAfterSeconds: number }}
   */
  return function take(bucketKey) {
    const currentTime = now();
    if (hits.size > 1000) sweep(currentTime);

    const bucket = hits.get(bucketKey);
    if (!bucket || bucket.resetAt <= currentTime) {
      hits.set(bucketKey, { count: 1, resetAt: currentTime + windowMs });
      return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
    }

    if (bucket.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - currentTime) / 1000)),
      };
    }

    bucket.count += 1;
    return { allowed: true, remaining: limit - bucket.count, retryAfterSeconds: 0 };
  };
}

/** Reports are cheap to file and expensive to clean up — keep this tight. */
export const REPORT_RATE_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 };

/**
 * Leaderboard/series submissions are unauthenticated and each one triggers a
 * Blobs read-modify-write; loose enough not to interfere with a player
 * legitimately retrying a submission or replaying a puzzle several times in
 * a session, tight enough to blunt a scripted flood.
 */
export const LEADERBOARD_RATE_LIMIT = { limit: 20, windowMs: 60 * 1000 };
