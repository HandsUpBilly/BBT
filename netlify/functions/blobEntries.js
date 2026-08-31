import { getStore } from '@netlify/blobs';

/**
 * Read-modify-write helpers for the leaderboard Blobs.
 *
 * Blobs has no transactions, so two submissions landing together used to lose
 * one. `updateEntries` retries on a conflicting etag, which turns a silent lost
 * update into a bounded retry. Netlify Blobs is also not immediately
 * read-consistent after a write — that is handled client-side by the delayed
 * refetch in App.tsx.
 */

const MAX_ATTEMPTS = 4;

export function leaderboardStore(name) {
  return getStore({
    name,
    siteID: process.env.NETLIFY_SITE_ID ?? process.env.SITE_ID,
    token: process.env.NETLIFY_TOKEN ?? process.env.NETLIFY_AUTH_TOKEN,
  });
}

export async function readEntries(store, key) {
  try {
    const result = await store.getWithMetadata(key, { type: 'text' });
    if (!result?.data) return { entries: [], etag: result?.etag };
    const parsed = JSON.parse(result.data);
    return { entries: Array.isArray(parsed) ? parsed : [], etag: result.etag };
  } catch {
    // Missing key, malformed JSON, or a store that predates metadata support —
    // treat all three as "start from empty" rather than failing the request.
    return { entries: [], etag: undefined };
  }
}

/**
 * Applies `mutate(entries) => entries` and writes the result, retrying if a
 * concurrent write moved the etag underneath us.
 *
 * @returns the entry list that was successfully persisted
 */
export async function updateEntries(store, key, mutate) {
  let lastError;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const { entries, etag } = await readEntries(store, key);
    const next = mutate(entries);
    const isFinalAttempt = attempt === MAX_ATTEMPTS - 1;

    // On the last try, write unconditionally. A store whose etag we could never
    // read (corrupt JSON, or a Blobs version without metadata support) must
    // still converge rather than rejecting every submission forever.
    const conditions = isFinalAttempt
      ? {}
      : etag
        ? { onlyIfMatch: etag }
        : { onlyIfNew: true };

    try {
      const result = await store.set(key, JSON.stringify(next), conditions);
      // Netlify reports a failed precondition as { modified: false }.
      if (result?.modified === false && !isFinalAttempt) {
        lastError = new Error('Leaderboard was updated concurrently');
        continue;
      }
      return next;
    } catch (error) {
      // Some @netlify/blobs versions reject instead of returning modified:false.
      lastError = error;
      if (isFinalAttempt) throw error;
    }
  }

  throw lastError ?? new Error('Could not update the leaderboard');
}

/** Clears one board through the same etag retry path as score submissions. */
export async function clearEntries(store, key) {
  let removed = 0;
  await updateEntries(store, key, entries => {
    removed = entries.length;
    return [];
  });
  return removed;
}
