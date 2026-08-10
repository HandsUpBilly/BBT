import { describe, expect, it } from 'vitest';
import { AVATAR_MAX_SOURCE_BYTES, validateAvatarFile } from './avatarImage';

/**
 * Only validateAvatarFile is covered here — encodeAvatarFile needs a real
 * canvas/Image decode pipeline jsdom does not provide. See the comment on
 * encodeAvatarFile: it is exercised by the Playwright harness, not vitest.
 */
function fileOf(type: string, size: number): File {
  return new File([new Uint8Array(size)], 'avatar', { type });
}

describe('validateAvatarFile', () => {
  it('accepts an on-size PNG, JPEG, or WebP', () => {
    expect(validateAvatarFile(fileOf('image/png', 1024))).toBeNull();
    expect(validateAvatarFile(fileOf('image/jpeg', 1024))).toBeNull();
    expect(validateAvatarFile(fileOf('image/webp', 1024))).toBeNull();
  });

  it('rejects an unsupported type', () => {
    expect(validateAvatarFile(fileOf('image/gif', 1024))).toMatch(/PNG, JPEG, or WebP/);
    expect(validateAvatarFile(fileOf('application/pdf', 1024))).toMatch(/PNG, JPEG, or WebP/);
  });

  it('rejects a file over the size cap', () => {
    expect(validateAvatarFile(fileOf('image/png', AVATAR_MAX_SOURCE_BYTES + 1))).toMatch(/too large/);
  });

  it('accepts a file exactly at the size cap', () => {
    expect(validateAvatarFile(fileOf('image/png', AVATAR_MAX_SOURCE_BYTES))).toBeNull();
  });
});
