/**
 * Turns a player-picked image file into a small, fixed-shape avatar.
 *
 * Everything here is a client-side convenience, not a security boundary — the
 * avatar is stored only in this browser's localStorage (see prefs.ts) and
 * nothing is uploaded. Still worth bounding: `bbt.prefs.v1` shares its quota
 * with auth, guest name and local scores, and an unbounded image would start
 * throwing quota errors in those unrelated features.
 *
 * Re-encoding to a fixed 256x256 WebP also strips EXIF metadata (which can
 * carry GPS coordinates on a photo straight off a phone) as a side effect of
 * redrawing through a canvas.
 */

export const AVATAR_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** Rejected before decoding — an 8K source image is not worth the memory to open. */
export const AVATAR_MAX_SOURCE_BYTES = 8 * 1024 * 1024;

export const AVATAR_SIZE = 256;

/** The cap prefs.ts enforces on read, so a hand-edited or future-shaped value can't bloat storage. */
export const AVATAR_MAX_DATA_URL_LENGTH = 200_000;

/** Pure and browser-independent, so it's covered by the vitest (jsdom) suite without a real canvas. */
export function validateAvatarFile(file: File): string | null {
  if (!AVATAR_ALLOWED_TYPES.includes(file.type as typeof AVATAR_ALLOWED_TYPES[number])) {
    return 'Choose a PNG, JPEG, or WebP image.';
  }
  if (file.size > AVATAR_MAX_SOURCE_BYTES) {
    return 'IMAGE REJECTED: File is too large. Choose one under 8 MB.';
  }
  return null;
}

/**
 * Decodes, center-crops to square, and downsamples to a fixed-size WebP data
 * URL. Canvas-dependent, so it only runs in a real browser — the Playwright
 * harness (not vitest) is what would exercise this end to end.
 */
export async function encodeAvatarFile(file: File): Promise<string> {
  const invalidReason = validateAvatarFile(file);
  if (invalidReason) throw new Error(invalidReason);

  const bitmap = await createImageBitmap(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const sourceX = (bitmap.width - side) / 2;
    const sourceY = (bitmap.height - side) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process that image.');
    ctx.drawImage(bitmap, sourceX, sourceY, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

    const dataUrl = canvas.toDataURL('image/webp', 0.85);
    if (dataUrl.length > AVATAR_MAX_DATA_URL_LENGTH) {
      throw new Error('IMAGE REJECTED: Choose a simpler image.');
    }
    return dataUrl;
  } finally {
    bitmap.close();
  }
}
