import { analyticsRollupStore, analyticsSessionStore, listAnalyticsSessions } from './analyticsStore.js';

export const config = { schedule: '@daily' };

function day(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function dailyRollup(date, records) {
  const sessions = records.filter(record => day(record.session.startedAt) === date).map(record => record.session);
  const attempts = sessions.flatMap(session => session.attempts ?? []);
  return {
    schemaVersion: 1,
    date,
    gameSessions: sessions.filter(session => (session.attempts ?? []).length > 0).length,
    engagedSessions: sessions.filter(session => (session.attempts ?? []).some(attempt => attempt.engagedAt)).length,
    puzzleStarts: attempts.length,
    puzzleCompletions: attempts.filter(attempt => attempt.outcome === 'completed').length,
  };
}

export default async function handler() {
  const sessionStore = analyticsSessionStore();
  const rollupStore = analyticsRollupStore();
  const records = await listAnalyticsSessions(sessionStore);
  const now = new Date();
  const today = day(now);
  const recentDays = new Set();
  for (let offset = 1; offset <= 7; offset += 1) {
    recentDays.add(day(new Date(now.getTime() - offset * 24 * 60 * 60 * 1000)));
  }
  for (const date of recentDays) {
    await rollupStore.set(`daily/${date}`, JSON.stringify(dailyRollup(date, records)));
  }

  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 13);
  let deleted = 0;
  for (const record of records) {
    if (Date.parse(record.session.lastSeenAt) >= cutoff.getTime()) continue;
    const date = day(record.session.startedAt);
    if (date === today) continue;
    const existingRollup = await rollupStore.get(`daily/${date}`, { type: 'text' });
    if (!existingRollup) {
      await rollupStore.set(`daily/${date}`, JSON.stringify(dailyRollup(date, records)));
    }
    await sessionStore.delete(record.key);
    deleted += 1;
  }
  return new Response(JSON.stringify({ rolledUp: recentDays.size, deleted }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}
