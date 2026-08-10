/**
 * Every completed run at a puzzle, kept on the device.
 *
 * The leaderboard deliberately stores personal *bests* only — `upsertPersonalBest`
 * never lets a worse run replace a better one, because a sloppy run after a
 * clean one used to destroy the good result. That is right for a ranking table
 * and useless for "how am I doing at this puzzle", which needs the runs that
 * were beaten as much as the one that wasn't.
 *
 * So this is a separate, local record: one entry per completed run, in order,
 * never overwritten. It is per-device by design — no server round-trip, nothing
 * to authenticate, and a player's full history of bad attempts stays on their
 * own machine rather than becoming retained data on ours.
 *
 * Every read tolerates junk. This is user-writable storage that survives
 * deploys, so a shape from a future version, a half-written value, or a quota
 * error must degrade to "no history" rather than break the screen it is on.
 */

const STORAGE_KEY = 'bbt.attempts.v1';

/**
 * Runs kept per puzzle. A determined player could otherwise grow this without
 * bound in a store shared with the auth token and the guest name, and a full
 * quota fails *those* writes too. Fifty is far more than the chart can usefully
 * plot and small enough to stay negligible.
 */
export const MAX_ATTEMPTS_PER_SCENARIO = 50;

export interface Attempt {
  /** ISO 8601, when the run finished. */
  at: string;
  /** Cumulative probability of the whole run: the score. 0 < p <= 1. */
  probability: number;
  diceCount: number;
}

export interface AttemptTrend {
  count: number;
  best: Attempt;
  first: Attempt;
  latest: Attempt;
  /**
   * Percentage points between the first run and the best one. Null until there
   * are two runs — "improvement" over a single attempt is not a number, and
   * showing 0% would read as "no progress" rather than "nothing to compare".
   */
  gainPoints: number | null;
}

type AttemptMap = Record<string, Attempt[]>;

function isAttempt(value: unknown): value is Attempt {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Attempt>;
  return (
    typeof candidate.at === 'string'
    && typeof candidate.probability === 'number'
    && Number.isFinite(candidate.probability)
    && candidate.probability > 0
    && candidate.probability <= 1
    && typeof candidate.diceCount === 'number'
    && Number.isInteger(candidate.diceCount)
    && candidate.diceCount >= 0
  );
}

function readAll(): AttemptMap {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const clean: AttemptMap = {};
    for (const [scenarioId, attempts] of Object.entries(parsed)) {
      if (!Array.isArray(attempts)) continue;
      const valid = attempts.filter(isAttempt);
      if (valid.length > 0) clean[scenarioId] = valid;
    }
    return clean;
  } catch {
    return {};
  }
}

/** Oldest first — the order runs were played, which is the order they plot in. */
export function readAttempts(scenarioId: string): Attempt[] {
  return readAll()[scenarioId] ?? [];
}

/**
 * Appends a completed run. Returns the puzzle's history including it, so a
 * caller can render without a second read.
 *
 * A failed write is not an error worth surfacing: the run itself is unaffected,
 * and the submit flow this sits beside must not abort because a private-browsing
 * quota rejected a nice-to-have.
 */
export function recordAttempt(scenarioId: string, attempt: Attempt): Attempt[] {
  const all = readAll();
  const next = [...(all[scenarioId] ?? []), attempt].slice(-MAX_ATTEMPTS_PER_SCENARIO);
  all[scenarioId] = next;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Storage unavailable or full — this run just won't be in the history.
  }
  return next;
}

/** Forgets one puzzle's history. */
export function clearAttempts(scenarioId: string): void {
  const all = readAll();
  if (!(scenarioId in all)) return;
  delete all[scenarioId];

  try {
    if (Object.keys(all).length === 0) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Nothing useful to do; the next read will still show the old history.
  }
}

/**
 * The headline numbers for a puzzle's history.
 *
 * Best is by probability, with fewer dice as the tie-break — the same ordering
 * the leaderboard uses, so "your best" here and the row on the board agree.
 */
export function summarizeAttempts(attempts: Attempt[]): AttemptTrend | null {
  if (attempts.length === 0) return null;

  const first = attempts[0];
  const latest = attempts[attempts.length - 1];
  const best = attempts.reduce((champion, attempt) => (
    attempt.probability > champion.probability
      || (attempt.probability === champion.probability && attempt.diceCount < champion.diceCount)
      ? attempt
      : champion
  ), first);

  return {
    count: attempts.length,
    best,
    first,
    latest,
    gainPoints: attempts.length > 1
      ? (best.probability - first.probability) * 100
      : null,
  };
}
