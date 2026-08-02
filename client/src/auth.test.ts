import { describe, it, expect } from 'vitest';
import { decodeJwtPayload, isTokenExpired } from './auth';

/** Builds an unsigned JWT with the given payload — only the payload is read. */
function makeToken(payload: Record<string, unknown>): string {
  const encode = (value: object) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'RS256' })}.${encode(payload)}.signature`;
}

describe('decodeJwtPayload', () => {
  it('reads standard claims', () => {
    const token = makeToken({ sub: '123', name: 'Coach', email: 'a@b.com' });
    expect(decodeJwtPayload(token)).toMatchObject({ sub: '123', name: 'Coach' });
  });

  it('decodes non-ASCII names as UTF-8, not latin1', () => {
    // atob yields one byte per character, so a naive decode turned "José" into
    // "JosÃ©" on the leaderboard and in the header.
    for (const name of ['José Müller', '中村 太郎', 'Ægir Þórsson']) {
      expect(decodeJwtPayload(makeToken({ sub: '1', name })).name).toBe(name);
    }
  });

  it('returns an empty payload for a malformed token', () => {
    expect(decodeJwtPayload('not-a-jwt')).toEqual({});
  });
});

describe('isTokenExpired', () => {
  const now = 1_700_000_000_000;

  it('treats a missing token as expired', () => {
    expect(isTokenExpired(null, now)).toBe(true);
  });

  it('accepts a token with time left', () => {
    const token = makeToken({ sub: '1', exp: now / 1000 + 3600 });
    expect(isTokenExpired(token, now)).toBe(false);
  });

  it('rejects a token past its expiry', () => {
    const token = makeToken({ sub: '1', exp: now / 1000 - 1 });
    expect(isTokenExpired(token, now)).toBe(true);
  });

  it('expires slightly early to cover clock skew and request latency', () => {
    // 30s of nominal life left, but within the skew window.
    const token = makeToken({ sub: '1', exp: now / 1000 + 30 });
    expect(isTokenExpired(token, now)).toBe(true);
  });

  it('defers to the server when there is no exp claim', () => {
    expect(isTokenExpired(makeToken({ sub: '1' }), now)).toBe(false);
  });

  it('treats an unparseable token as expired', () => {
    expect(isTokenExpired('garbage', now)).toBe(true);
  });
});
