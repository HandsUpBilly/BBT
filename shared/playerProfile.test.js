import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PlayerProfileValidationError,
  decodeUploadedAvatar,
  normalizeProfileUserId,
  toPublicPlayerProfile,
  updatePlayerProfile,
} from './playerProfile.js';

function webpDataUrl(width = 256, height = 256) {
  const bytes = new Uint8Array(30);
  bytes.set(Buffer.from('RIFF'), 0);
  bytes.set(Buffer.from('WEBP'), 8);
  bytes.set(Buffer.from('VP8X'), 12);
  bytes[16] = 10;
  const widthMinusOne = width - 1;
  const heightMinusOne = height - 1;
  bytes[24] = widthMinusOne & 0xff;
  bytes[25] = (widthMinusOne >> 8) & 0xff;
  bytes[26] = (widthMinusOne >> 16) & 0xff;
  bytes[27] = heightMinusOne & 0xff;
  bytes[28] = (heightMinusOne >> 8) & 0xff;
  bytes[29] = (heightMinusOne >> 16) & 0xff;
  return `data:image/webp;base64,${Buffer.from(bytes).toString('base64')}`;
}

const googleUser = {
  provider: 'google',
  providerUserId: 'google-user-1',
  email: 'coach@example.com',
  picture: 'https://lh3.googleusercontent.com/a/profile-photo',
};

test('accepts a bounded 256 square WebP and rejects spoofed dimensions', () => {
  assert.equal(decodeUploadedAvatar(webpDataUrl()).length, 30);
  assert.throws(
    () => decodeUploadedAvatar(webpDataUrl(512, 256)),
    error => error instanceof PlayerProfileValidationError && /256 by 256/.test(error.message),
  );
  assert.throws(
    () => decodeUploadedAvatar('data:image/png;base64,AAAA'),
    error => error instanceof PlayerProfileValidationError && /WebP/.test(error.message),
  );
});

test('updates uploaded avatar and public country without exposing stored image data', () => {
  const profile = updatePlayerProfile(null, googleUser, {
    avatar: { source: 'upload', dataUrl: webpDataUrl() },
    country: '  United   Kingdom  ',
  }, '2026-08-31T10:00:00.000Z');

  assert.equal(profile.country, 'United Kingdom');
  assert.equal(profile.avatar.source, 'upload');
  assert.deepEqual(toPublicPlayerProfile(profile), {
    userId: 'google-user-1',
    country: 'United Kingdom',
    avatarVersion: '2026-08-31T10:00:00.000Z',
  });
});

test('uses only the verified token picture for a Google avatar', () => {
  const profile = updatePlayerProfile(null, googleUser, { avatar: { source: 'google' } });
  assert.equal(profile.avatar.url, googleUser.picture);
  assert.throws(
    () => updatePlayerProfile(null, { ...googleUser, picture: 'https://example.com/fake.png' }, { avatar: { source: 'google' } }),
    error => error instanceof PlayerProfileValidationError && /Google profile picture/.test(error.message),
  );
});

test('clears either public field without disturbing the other', () => {
  const existing = updatePlayerProfile(null, googleUser, {
    avatar: { source: 'google' }, country: 'New Zealand',
  }, '2026-08-31T10:00:00.000Z');
  const withoutAvatar = updatePlayerProfile(existing, googleUser, { avatar: null }, '2026-08-31T10:01:00.000Z');
  assert.equal(withoutAvatar.avatar, undefined);
  assert.equal(withoutAvatar.avatarUpdatedAt, undefined);
  assert.equal(withoutAvatar.country, 'New Zealand');
  const withoutCountry = updatePlayerProfile(withoutAvatar, googleUser, { country: '' });
  assert.equal(withoutCountry.country, undefined);
});

test('rejects unsafe ids, oversized country text, and empty updates', () => {
  assert.throws(() => normalizeProfileUserId('../other-user'), PlayerProfileValidationError);
  assert.throws(() => updatePlayerProfile(null, googleUser, { country: 'x'.repeat(65) }), PlayerProfileValidationError);
  assert.throws(() => updatePlayerProfile(null, googleUser, {}), PlayerProfileValidationError);
});
