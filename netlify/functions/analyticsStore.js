import { getStore } from '@netlify/blobs';
import { reduceAnalyticsBatch } from '../../shared/analyticsValidation.js';

const MAX_ATTEMPTS = 4;

export function analyticsSessionStore() {
  return getStore({
    name: 'analytics-sessions',
    siteID: process.env.NETLIFY_SITE_ID ?? process.env.SITE_ID,
    token: process.env.NETLIFY_TOKEN ?? process.env.NETLIFY_AUTH_TOKEN,
  });
}
export function analyticsRollupStore() {
  return getStore({
    name: 'analytics-rollups',
    siteID: process.env.NETLIFY_SITE_ID ?? process.env.SITE_ID,
    token: process.env.NETLIFY_TOKEN ?? process.env.NETLIFY_AUTH_TOKEN,
  });
}

export function sessionKey(sessionStartedAt, sessionId) {
  return `sessions/${sessionStartedAt.slice(0, 7)}/${sessionId}`;
}

export async function readAnalyticsSession(store, key) {
  try {
    const result = await store.getWithMetadata(key, { type: 'text' });
    if (!result?.data) return { session: null, etag: result?.etag };
    const session = JSON.parse(result.data);
    return { session: session && typeof session === 'object' ? session : null, etag: result.etag };
  } catch {
    return { session: null, etag: undefined };
  }
}

export async function mergeAnalyticsBatch(store, batch) {
  const key = sessionKey(batch.sessionStartedAt, batch.sessionId);
  let lastError;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const { session, etag } = await readAnalyticsSession(store, key);
    const next = reduceAnalyticsBatch(session, batch);
    const finalAttempt = attempt === MAX_ATTEMPTS - 1;
    const conditions = finalAttempt ? {} : etag ? { onlyIfMatch: etag } : { onlyIfNew: true };
    try {
      const result = await store.set(key, JSON.stringify(next), conditions);
      if (result?.modified === false && !finalAttempt) continue;
      return next;
    } catch (error) {
      lastError = error;
      if (finalAttempt) throw error;
    }
  }
  throw lastError ?? new Error('Could not save analytics');
}

async function listKeys(store, prefix) {
  const keys = [];
  let cursor;
  do {
    const result = await store.list({ prefix, ...(cursor ? { cursor } : {}) });
    keys.push(...(result.blobs ?? []).map(blob => blob.key));
    cursor = result.next_cursor ?? result.nextCursor;
  } while (cursor);
  return keys;
}

export async function listAnalyticsSessions(store, prefix = 'sessions/') {
  const keys = await listKeys(store, prefix);
  const values = await Promise.all(keys.map(async key => {
    try {
      const data = await store.get(key, { type: 'text' });
      return { key, session: data ? JSON.parse(data) : null };
    } catch {
      return { key, session: null };
    }
  }));
  return values.filter(value => value.session && typeof value.session === 'object');
}
