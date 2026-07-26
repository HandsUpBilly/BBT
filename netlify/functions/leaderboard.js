import { getStore } from '@netlify/blobs';
import { randomUUID } from 'crypto';
import { AuthError, authErrorResponse, entryAuthFields, verifyOptionalGoogleUser } from './auth.js';

const TOP_N = 10;

function sortEntries(entries) {
  return entries.sort(
    (a, b) => b.probability - a.probability || a.diceCount - b.diceCount
  );
}

async function readEntries(store, scenarioId) {
  try {
    const raw = await store.get(scenarioId, { type: 'text' });
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeEntries(store, scenarioId, entries) {
  await store.set(scenarioId, JSON.stringify(entries));
}

export default async function handler(req) {
  const url = new URL(req.url);
  // Try query param first (set by netlify.toml redirect), then fall back to last path segment
  const scenarioId =
    url.searchParams.get('scenarioId') ||
    url.pathname.split('/').filter(Boolean).pop() ||
    null;

  if (!scenarioId) {
    return new Response(JSON.stringify({ error: 'scenarioId required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const store = getStore({
    name: 'leaderboard',
    siteID: process.env.NETLIFY_SITE_ID ?? process.env.SITE_ID,
    token: process.env.NETLIFY_TOKEN ?? process.env.NETLIFY_AUTH_TOKEN,
  });

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const entries = await readEntries(store, scenarioId);
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

    const { name, probability, diceCount, moves } = body;
    if ((!name && !user) || probability == null || diceCount == null) {
      return new Response(
        JSON.stringify({ error: 'name, probability and diceCount are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const entry = {
      id: randomUUID(),
      scenarioId,
      name: String(user?.name ?? name).slice(0, 32),
      probability: Number(probability),
      diceCount: Number(diceCount),
      date: new Date().toISOString(),
      moves: Array.isArray(moves) ? moves : [],
      ...entryAuthFields(user),
    };

    const entries = await readEntries(store, scenarioId);

    const idx = user
      ? entries.findIndex(e => e.userId === user.providerUserId)
      : entries.findIndex(e => e.name === entry.name);
    if (idx >= 0) {
      entries[idx] = entry;
    } else {
      entries.push(entry);
    }

    const updated = sortEntries(entries).slice(0, TOP_N);
    await writeEntries(store, scenarioId, updated);

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

