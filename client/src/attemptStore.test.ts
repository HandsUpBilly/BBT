import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_ATTEMPTS_PER_SCENARIO,
  clearAttempts,
  readAttempts,
  recordAttempt,
  summarizeAttempts,
  type Attempt,
} from './attemptStore';

const KEY = 'bbt.attempts.v1';

function attempt(probability: number, diceCount = 1, at = '2026-08-01T10:00:00.000Z'): Attempt {
  return { at, probability, diceCount };
}

/**
 * jsdom here gives `window.localStorage` as a bare object with no Storage
 * methods at all, so these tests install their own. That is also why the module
 * under test guards every access: in this environment an unguarded `getItem`
 * would be a TypeError, not a miss.
 */
function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
}

const originalStorage = Object.getOwnPropertyDescriptor(window, 'localStorage');
let storage: ReturnType<typeof fakeStorage>;

function installStorage(value: unknown) {
  Object.defineProperty(window, 'localStorage', { configurable: true, value });
}

beforeEach(() => {
  storage = fakeStorage();
  installStorage(storage);
});

afterEach(() => {
  if (originalStorage) Object.defineProperty(window, 'localStorage', originalStorage);
  else Reflect.deleteProperty(window, 'localStorage');
});

describe('recording', () => {
  it('keeps every run in the order it was played, best or not', () => {
    recordAttempt('scn-001', attempt(0.5));
    recordAttempt('scn-001', attempt(0.9));
    // The leaderboard would discard this one; the history is the point.
    recordAttempt('scn-001', attempt(0.2));

    expect(readAttempts('scn-001').map(a => a.probability)).toEqual([0.5, 0.9, 0.2]);
  });

  it('keeps each puzzle separate', () => {
    recordAttempt('scn-001', attempt(0.5));
    recordAttempt('scn-002', attempt(0.7));

    expect(readAttempts('scn-001')).toHaveLength(1);
    expect(readAttempts('scn-002')).toHaveLength(1);
    expect(readAttempts('scn-003')).toEqual([]);
  });

  it('returns the puzzle history including the new run', () => {
    recordAttempt('scn-001', attempt(0.5));
    expect(recordAttempt('scn-001', attempt(0.6)).map(a => a.probability)).toEqual([0.5, 0.6]);
  });

  it('drops the oldest runs past the cap rather than growing without bound', () => {
    for (let i = 0; i < MAX_ATTEMPTS_PER_SCENARIO + 5; i += 1) {
      recordAttempt('scn-001', attempt(0.5, i));
    }

    const kept = readAttempts('scn-001');
    expect(kept).toHaveLength(MAX_ATTEMPTS_PER_SCENARIO);
    expect(kept[0].diceCount).toBe(5);
    expect(kept[kept.length - 1].diceCount).toBe(MAX_ATTEMPTS_PER_SCENARIO + 4);
  });

  it('does not throw when storage rejects the write', () => {
    storage.setItem = () => { throw new Error('QuotaExceededError'); };

    // A private-browsing quota must not take the submit flow down with it.
    expect(() => recordAttempt('scn-001', attempt(0.5))).not.toThrow();
  });

  it('does not throw when the environment has no Storage API at all', () => {
    // jsdom's default here — see the note above fakeStorage.
    installStorage({});

    expect(() => recordAttempt('scn-001', attempt(0.5))).not.toThrow();
    expect(readAttempts('scn-001')).toEqual([]);
    expect(() => clearAttempts('scn-001')).not.toThrow();
  });
});

describe('reading damaged storage', () => {
  it('treats unparseable JSON as no history', () => {
    storage.setItem(KEY, 'not json{');
    expect(readAttempts('scn-001')).toEqual([]);
  });

  it('treats a non-object payload as no history', () => {
    storage.setItem(KEY, JSON.stringify(['scn-001']));
    expect(readAttempts('scn-001')).toEqual([]);
  });

  it('drops entries that are not attempts and keeps the rest', () => {
    storage.setItem(KEY, JSON.stringify({
      'scn-001': [
        attempt(0.5),
        null,
        { at: '2026-08-01T10:00:00.000Z' },
        { at: 5, probability: 0.5, diceCount: 1 },
        { at: '2026-08-01T10:00:00.000Z', probability: 1.5, diceCount: 1 },
        { at: '2026-08-01T10:00:00.000Z', probability: 0, diceCount: 1 },
        { at: '2026-08-01T10:00:00.000Z', probability: 0.5, diceCount: 1.5 },
        attempt(0.8),
      ],
      'scn-002': 'nonsense',
    }));

    expect(readAttempts('scn-001').map(a => a.probability)).toEqual([0.5, 0.8]);
    expect(readAttempts('scn-002')).toEqual([]);
  });
});

describe('clearing', () => {
  it('forgets one puzzle and leaves the others', () => {
    recordAttempt('scn-001', attempt(0.5));
    recordAttempt('scn-002', attempt(0.7));

    clearAttempts('scn-001');

    expect(readAttempts('scn-001')).toEqual([]);
    expect(readAttempts('scn-002')).toHaveLength(1);
  });

  it('removes the key entirely once nothing is left', () => {
    recordAttempt('scn-001', attempt(0.5));
    clearAttempts('scn-001');

    expect(storage.getItem(KEY)).toBeNull();
  });
});

describe('summarizeAttempts', () => {
  it('is null with no history, so callers render the empty state', () => {
    expect(summarizeAttempts([])).toBeNull();
  });

  it('reports first, latest and best, with best by fewest dice on a tie', () => {
    const trend = summarizeAttempts([
      attempt(0.4, 3),
      attempt(0.9, 4),
      attempt(0.9, 2),
      attempt(0.6, 1),
    ]);

    expect(trend?.count).toBe(4);
    expect(trend?.first.probability).toBe(0.4);
    expect(trend?.latest.probability).toBe(0.6);
    // Same probability as run 2 — the leaderboard's tie-break picks run 3.
    expect(trend?.best.diceCount).toBe(2);
  });

  it('measures the gain from the first run to the best one', () => {
    expect(summarizeAttempts([attempt(0.25), attempt(0.75)])?.gainPoints).toBeCloseTo(50);
  });

  it('shows no gain when the first run is still the best', () => {
    // Measured against the best, not the latest — so a worse run afterwards
    // reads as "you haven't beaten it yet", not as going backwards.
    expect(summarizeAttempts([attempt(0.8), attempt(0.3)])?.gainPoints).toBeCloseTo(0);
  });

  it('has no gain to report from a single run', () => {
    // Not 0 — "no progress" and "nothing to compare" are different answers.
    expect(summarizeAttempts([attempt(0.5)])?.gainPoints).toBeNull();
  });
});
