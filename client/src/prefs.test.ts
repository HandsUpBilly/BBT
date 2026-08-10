import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GUEST_PREFS_KEY, readAllPrefs, readPrefs, writePrefs } from './prefs';

const KEY = 'bbt.prefs.v1';
const VALID_AVATAR = `data:image/webp;base64,${'A'.repeat(20)}`;

/** Same fake as attemptStore.test.ts — jsdom's window.localStorage has no Storage methods at all. */
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

describe('reading with nothing stored', () => {
  it('returns an empty preference set', () => {
    expect(readPrefs('user-1')).toEqual({});
    expect(readAllPrefs()).toEqual({});
  });
});

describe('writing and reading back', () => {
  it('persists a token style choice under the identity key', () => {
    writePrefs('user-1', { tokenStyle: 'simple' });
    expect(readPrefs('user-1')).toEqual({ tokenStyle: 'simple' });
  });

  it('persists an avatar data URL', () => {
    writePrefs('user-1', { avatar: VALID_AVATAR });
    expect(readPrefs('user-1')).toEqual({ avatar: VALID_AVATAR });
  });

  it('merges a second write rather than replacing the whole record', () => {
    writePrefs('user-1', { tokenStyle: 'simple' });
    writePrefs('user-1', { avatar: VALID_AVATAR });
    expect(readPrefs('user-1')).toEqual({ tokenStyle: 'simple', avatar: VALID_AVATAR });
  });

  it('clears a field when the patch sets it to undefined', () => {
    writePrefs('user-1', { avatar: VALID_AVATAR });
    writePrefs('user-1', { avatar: undefined });
    expect(readPrefs('user-1')).toEqual({});
  });

  it('keeps separate accounts apart, including the fixed guest key', () => {
    writePrefs('user-1', { tokenStyle: 'simple' });
    writePrefs(GUEST_PREFS_KEY, { tokenStyle: 'portrait' });
    expect(readPrefs('user-1')).toEqual({ tokenStyle: 'simple' });
    expect(readPrefs(GUEST_PREFS_KEY)).toEqual({ tokenStyle: 'portrait' });
  });
});

describe('tolerating junk', () => {
  it('ignores an invalid token style value', () => {
    storage.setItem(KEY, JSON.stringify({ 'user-1': { tokenStyle: 'chrome' } }));
    expect(readPrefs('user-1')).toEqual({});
  });

  it('ignores an avatar value that is not a data:image URL', () => {
    storage.setItem(KEY, JSON.stringify({ 'user-1': { avatar: 'https://evil.example/x.png' } }));
    expect(readPrefs('user-1')).toEqual({});
  });

  it('ignores an oversized avatar value', () => {
    const huge = `data:image/webp;base64,${'A'.repeat(300_000)}`;
    storage.setItem(KEY, JSON.stringify({ 'user-1': { avatar: huge } }));
    expect(readPrefs('user-1')).toEqual({});
  });

  it('degrades to empty on malformed JSON', () => {
    storage.setItem(KEY, '{not json');
    expect(readAllPrefs()).toEqual({});
  });

  it('degrades to empty when the top-level value is an array', () => {
    storage.setItem(KEY, JSON.stringify([1, 2, 3]));
    expect(readAllPrefs()).toEqual({});
  });

  it('drops an unrecognized field but keeps the valid ones alongside it', () => {
    storage.setItem(KEY, JSON.stringify({ 'user-1': { tokenStyle: 'simple', futureField: 'x' } }));
    expect(readPrefs('user-1')).toEqual({ tokenStyle: 'simple' });
  });
});

describe('write failure', () => {
  it('does not throw when localStorage.setItem fails', () => {
    installStorage({
      getItem: storage.getItem,
      setItem: () => { throw new Error('quota exceeded'); },
      removeItem: storage.removeItem,
    });
    expect(() => writePrefs('user-1', { tokenStyle: 'simple' })).not.toThrow();
  });
});
