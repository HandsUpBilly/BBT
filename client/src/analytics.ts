import { submitAnalyticsBatch } from './api';

const SESSION_KEY = 'bbt.analytics.session.v1';
const QUEUE_KEY = 'bbt.analytics.queue.v1';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_QUEUE_EVENTS = 200;
const MAX_BATCH_EVENTS = 50;
const MAX_QUEUE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type AnalyticsEventType =
  | 'active-time'
  | 'puzzle-started' | 'puzzle-engaged' | 'puzzle-action' | 'puzzle-ended'
  | 'puzzle-restarted' | 'series-started' | 'series-advanced' | 'series-ended'
  | 'interaction';

interface QueuedEvent {
  type: AnalyticsEventType;
  at: string;
  data?: Record<string, unknown>;
}

interface PendingBatch {
  schemaVersion: 1;
  batchId: string;
  sessionId: string;
  sessionStartedAt: string;
  events: QueuedEvent[];
}

interface SessionState {
  id: string;
  startedAt: string;
  lastActivityAt: string;
}

interface CollectorOptions {
  enabled?: boolean;
  now?: () => Date;
  localStorage?: Storage;
  sessionStorage?: Storage;
  transport?: (payload: unknown, keepalive?: boolean) => Promise<boolean>;
  document?: Document;
  window?: Window;
}

function randomId(): string {
  return crypto.randomUUID();
}

function safeParse<T>(storage: Storage | undefined, key: string): T | null {
  try {
    const value = storage?.getItem(key);
    return value ? JSON.parse(value) as T : null;
  } catch {
    return null;
  }
}

function safeSet(storage: Storage | undefined, key: string, value: unknown): boolean {
  try {
    storage?.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    return Boolean(storage);
  } catch {
    return false;
  }
}

function deployedProduction(): boolean {
  if (typeof window === 'undefined') return false;
  return import.meta.env.PROD && !['localhost', '127.0.0.1'].includes(window.location.hostname);
}

export class AnalyticsCollector {
  private readonly enabled: boolean;
  private readonly now: () => Date;
  private readonly local: Storage | undefined;
  private readonly sessionStorage: Storage | undefined;
  private readonly transport: (payload: unknown, keepalive?: boolean) => Promise<boolean>;
  private readonly doc: Document | undefined;
  private readonly win: Window | undefined;
  private session!: SessionState;
  private pending: PendingBatch[] = [];
  private buffer: QueuedEvent[] = [];
  private flushTimer: number | undefined;
  private activeTimer: number | undefined;
  private started = false;
  private activeAttemptId: string | null = null;
  private activeSinceMs: number | null = null;

  constructor(options: CollectorOptions = {}) {
    this.enabled = options.enabled ?? deployedProduction();
    this.now = options.now ?? (() => new Date());
    this.local = options.localStorage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    this.sessionStorage = options.sessionStorage ?? (typeof window !== 'undefined' ? window.sessionStorage : undefined);
    this.transport = options.transport ?? submitAnalyticsBatch;
    this.doc = options.document ?? (typeof document !== 'undefined' ? document : undefined);
    this.win = options.window ?? (typeof window !== 'undefined' ? window : undefined);
  }

  start(): void {
    if (!this.enabled || this.started) return;
    this.started = true;
    const queueCutoff = this.now().getTime() - MAX_QUEUE_AGE_MS;
    this.pending = (safeParse<PendingBatch[]>(this.local, QUEUE_KEY) ?? []).filter(batch =>
      batch.events.some(event => Date.parse(event.at) >= queueCutoff),
    );
    this.persistQueue();
    this.session = this.readOrCreateSession();
    this.doc?.addEventListener('visibilitychange', this.onVisibility);
    this.win?.addEventListener('pagehide', this.onPageHide);
    this.activeTimer = this.win?.setInterval(() => {
      this.flushActiveTime();
    }, 60_000);
    void this.drain(false);
  }

  stop(): void {
    if (!this.started) return;
    this.doc?.removeEventListener('visibilitychange', this.onVisibility);
    this.win?.removeEventListener('pagehide', this.onPageHide);
    if (this.activeTimer !== undefined) this.win?.clearInterval(this.activeTimer);
    if (this.flushTimer !== undefined) this.win?.clearTimeout(this.flushTimer);
    this.started = false;
  }

  track(type: AnalyticsEventType, data?: Record<string, unknown>): void {
    if (!this.enabled) return;
    if (!this.started) this.start();
    this.ensureCurrentSession();
    const now = this.now().toISOString();
    this.session.lastActivityAt = now;
    safeSet(this.sessionStorage, SESSION_KEY, this.session);
    this.buffer.push({ type, at: now, ...(data ? { data } : {}) });
    this.trimQueue();
    if (this.buffer.length >= 10) void this.flush(false);
    else if (this.flushTimer === undefined) {
      this.flushTimer = this.win?.setTimeout(() => { this.flushTimer = undefined; void this.flush(false); }, 5_000);
    }
  }

  newId(): string { return randomId(); }
  setActiveAttempt(attemptId: string | null): void {
    if (attemptId === this.activeAttemptId) return;
    this.flushActiveTime(true);
    this.activeAttemptId = attemptId;
    this.activeSinceMs = attemptId && this.doc?.visibilityState !== 'hidden' ? this.now().getTime() : null;
  }

  async flush(keepalive: boolean): Promise<void> {
    if (!this.enabled) return;
    if (this.buffer.length > 0) {
      this.pending.push({
        schemaVersion: 1,
        batchId: randomId(),
        sessionId: this.session.id,
        sessionStartedAt: this.session.startedAt,
        events: this.buffer.splice(0, MAX_BATCH_EVENTS),
      });
      if (this.buffer.length > 0) return this.flush(keepalive);
      this.persistQueue();
    }
    await this.drain(keepalive);
  }

  private readOrCreateSession(): SessionState {
    const now = this.now();
    const stored = safeParse<SessionState>(this.sessionStorage, SESSION_KEY);
    if (stored && now.getTime() - Date.parse(stored.lastActivityAt) < SESSION_TIMEOUT_MS) return stored;
    const created = { id: randomId(), startedAt: now.toISOString(), lastActivityAt: now.toISOString() };
    safeSet(this.sessionStorage, SESSION_KEY, created);
    return created;
  }

  private ensureCurrentSession(): void {
    if (this.now().getTime() - Date.parse(this.session.lastActivityAt) < SESSION_TIMEOUT_MS) return;
    if (this.buffer.length > 0) void this.flush(false);
    this.session = this.readOrCreateSession();
    this.activeAttemptId = null;
  }

  private trimQueue(): void {
    let count = this.buffer.length + this.pending.reduce((total, batch) => total + batch.events.length, 0);
    while (count > MAX_QUEUE_EVENTS && this.pending.length > 0) {
      count -= this.pending[0].events.length;
      this.pending.shift();
    }
    if (count > MAX_QUEUE_EVENTS) this.buffer.splice(0, count - MAX_QUEUE_EVENTS);
    this.persistQueue();
  }

  private persistQueue(): void { safeSet(this.local, QUEUE_KEY, this.pending); }

  private flushActiveTime(force = false): void {
    if (!this.activeAttemptId) {
      this.activeSinceMs = null;
      return;
    }
    if (!force && this.doc?.visibilityState === 'hidden') {
      this.activeSinceMs = null;
      return;
    }
    const now = this.now().getTime();
    if (this.activeSinceMs === null) {
      this.activeSinceMs = now;
      return;
    }
    const seconds = Math.min(60, Math.floor((now - this.activeSinceMs) / 1000));
    this.activeSinceMs = now;
    if (seconds > 0) this.track('active-time', { seconds, attemptId: this.activeAttemptId });
  }

  private async drain(keepalive: boolean): Promise<void> {
    while (this.pending.length > 0) {
      let ok = false;
      if (keepalive && this.win?.navigator.sendBeacon) {
        try {
          ok = this.win.navigator.sendBeacon(
            '/api/analytics',
            new Blob([JSON.stringify(this.pending[0])], { type: 'application/json' }),
          );
        } catch {
          ok = false;
        }
      }
      if (!ok) ok = await this.transport(this.pending[0], keepalive);
      if (!ok) break;
      this.pending.shift();
      this.persistQueue();
    }
  }

  private readonly onVisibility = () => {
    if (this.doc?.visibilityState === 'hidden') {
      this.flushActiveTime(true);
      this.activeSinceMs = null;
      void this.flush(true);
    } else if (this.activeAttemptId) {
      this.activeSinceMs = this.now().getTime();
    }
  };

  private readonly onPageHide = () => {
    this.flushActiveTime(true);
    this.activeSinceMs = null;
    void this.flush(true);
  };
}

const analytics = new AnalyticsCollector();

export function initializeAnalytics(): () => void {
  analytics.start();
  return () => analytics.stop();
}

export function trackAnalytics(type: AnalyticsEventType, data?: Record<string, unknown>): void {
  analytics.track(type, data);
}

export function newAnalyticsId(): string { return analytics.newId(); }
export function setActiveAnalyticsAttempt(id: string | null): void { analytics.setActiveAttempt(id); }
