import { getStore } from '@netlify/blobs';
import { randomUUID } from 'crypto';
import { AuthError, authErrorResponse, entryAuthFields, verifyOptionalGoogleUser } from './auth.js';

const TOP_N = 10;
const KEY = 'series';

function sortEntries(entries) {
  return entries.sort(
    (a, b) => b.probability - a.probability || a.diceCount - b.diceCount
  );
}

async function readEntries(store) {
  try {
    const raw = await store.get(KEY, { type: 'text' });
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeEntries(store, entries) {
  await store.set(KEY, JSON.stringify(entries));
}

export default async function handler(req) {
  const store = getStore({
    name: 'series-leaderboard',
    siteID: process.env.NETLIFY_SITE_ID ?? process.env.SITE_ID,
    token: process.env.NETLIFY_TOKEN ?? process.env.NETLIFY_AUTH_TOKEN,
  });

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const entries = await readEntries(store);
    const top = sortEntries(entries).slice(0, TOP_N);
    return new Response(JSON.stringify(top), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── POST ─────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    let user = null;
    try {
      user = await verifyOptionalGoogleUser(req);
    } catch (error) {
      if (error instanceof AuthError) return authErrorResponse(error);
      throw error;
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { name, probability, diceCount, puzzles } = body;
    if ((!name && !user) || probability == null || diceCount == null) {
      return new Response(
        JSON.stringify({ error: 'name, probability and diceCount are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const entry = {
      id: randomUUID(),
      name: String(user?.name ?? name).slice(0, 32),
      probability: Number(probability),
      diceCount: Number(diceCount),
      date: new Date().toISOString(),
      puzzles: Array.isArray(puzzles) ? puzzles : [],
      ...entryAuthFields(user),
    };

    const entries = await readEntries(store);

    const idx = user
      ? entries.findIndex(e => e.userId === user.providerUserId)
      : entries.findIndex(e => e.name === entry.name);
    if (idx >= 0) {
      entries[idx] = entry;
    } else {
      entries.push(entry);
    }

    const updated = sortEntries(entries).slice(0, TOP_N);
    await writeEntries(store, updated);

    return new Response(JSON.stringify(entry), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  });
}
