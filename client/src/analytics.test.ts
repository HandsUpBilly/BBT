import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsCollector } from './analytics';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

afterEach(() => vi.useRealTimers());

describe('AnalyticsCollector', () => {
  it('reuses a game session id and keeps retried batch ids stable', async () => {
    vi.useFakeTimers();
    const local = memoryStorage();
    const session = memoryStorage();
    const sent: unknown[] = [];
    const collector = new AnalyticsCollector({
      enabled: true, localStorage: local, sessionStorage: session,
      transport: async payload => { sent.push(payload); return sent.length > 1; },
      now: () => new Date('2026-08-19T12:00:00.000Z'),
      window, document,
    });
    collector.start();
    collector.track('interaction', { name: 'settings', outcome: 'opened' });
    await collector.flush(false);
    await collector.flush(false);
    const first = sent[0] as { batchId: string; sessionId: string };
    const second = sent[1] as { batchId: string; sessionId: string };
    expect(second.batchId).toBe(first.batchId);
    expect(second.sessionId).toBe(first.sessionId);
    collector.stop();
  });

  it('does nothing when collection is disabled', async () => {
    const transport = vi.fn(async () => true);
    const collector = new AnalyticsCollector({ enabled: false, transport, window, document });
    collector.start();
    collector.track('interaction', { name: 'settings', outcome: 'opened' });
    await collector.flush(false);
    expect(transport).not.toHaveBeenCalled();
  });

  it('reports measured visible play time instead of rounding a short attempt to one minute', async () => {
    const sent: Array<{ events: Array<{ type: string; data: { seconds?: number } }> }> = [];
    let now = new Date('2026-08-19T12:00:00.000Z');
    const collector = new AnalyticsCollector({
      enabled: true,
      localStorage: memoryStorage(),
      sessionStorage: memoryStorage(),
      transport: async payload => { sent.push(payload as typeof sent[number]); return true; },
      now: () => now,
      window,
      document,
    });
    collector.start();
    collector.setActiveAttempt('44444444-4444-4444-8444-444444444444');
    now = new Date('2026-08-19T12:00:12.000Z');
    collector.setActiveAttempt(null);
    await collector.flush(false);

    const activeEvent = sent.flatMap(batch => batch.events).find(event => event.type === 'active-time');
    expect(activeEvent?.data.seconds).toBe(12);
    collector.stop();
  });
});
