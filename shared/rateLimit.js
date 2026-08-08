// Minimal fixed-window rate limiter shared by both report endpoints.
//
// State is per-process and in-memory. On Express that is a real limit; on
// Netlify Functions it only holds for as long as an instance stays warm, so it
// throttles a single attacker's burst but is not a hard guarantee. That is the
// intended trade-off for now: it removes the "hold Enter and file 200 GitHub
// issues" hole without adding a datastore dependency. Move to a Blobs- or
// KV-backed counter if abuse actually materializes.

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
