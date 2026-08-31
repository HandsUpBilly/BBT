import { describe, expect, it } from 'vitest';
import { formatReleaseNoteDate, loadReleaseNotes, parseReleaseNote } from './releaseNotes';

describe('parseReleaseNote', () => {
  it('reads the title, summary, and categorized items in category order', () => {
    const note = parseReleaseNote('2026-08-31', `# Release Notes — August 31, 2026

A quiet week.

## Fixed

- Squashed a bug.

## New

- Added a thing.
- Added another thing.
`);

    expect(note.date).toBe('2026-08-31');
    expect(note.title).toBe('Release Notes — August 31, 2026');
    expect(note.summary).toBe('A quiet week.');
    expect(note.categories.map(category => category.name)).toEqual(['New', 'Fixed']);
    expect(note.categories[0].items).toEqual(['Added a thing.', 'Added another thing.']);
    expect(note.categories[1].items).toEqual(['Squashed a bug.']);
  });

  it('falls back to a formatted date as the title when there is no heading', () => {
    const note = parseReleaseNote('2026-08-31', '## New\n- Added a thing.\n');
    expect(note.title).toBe(formatReleaseNoteDate('2026-08-31'));
  });

  it('drops categories with no items and keeps unrecognized categories at the end', () => {
    const note = parseReleaseNote('2026-08-31', `## Fixed

## New

- Added a thing.

## Notes

- An aside.
`);
    expect(note.categories.map(category => category.name)).toEqual(['New', 'Notes']);
  });

  it('joins a bullet that soft-wraps onto a following line', () => {
    const note = parseReleaseNote('2026-08-31', `## Improved

- A long sentence that wraps onto
  a second line in the source file.
- A second, unwrapped item.
`);
    expect(note.categories[0].items).toEqual([
      'A long sentence that wraps onto a second line in the source file.',
      'A second, unwrapped item.',
    ]);
  });

  it('has no summary when there is nothing before the first heading', () => {
    const note = parseReleaseNote('2026-08-31', '## New\n- Added a thing.\n');
    expect(note.summary).toBeUndefined();
  });
});

describe('loadReleaseNotes', () => {
  it('extracts the date from each file name and sorts newest first', () => {
    const notes = loadReleaseNotes({
      '/docs/release-notes/2026-08-17.md': '## New\n- Older week.\n',
      '/docs/release-notes/2026-08-31.md': '## New\n- Newer week.\n',
      '/docs/release-notes/2026-08-24.md': '## New\n- Middle week.\n',
    });

    expect(notes.map(note => note.date)).toEqual(['2026-08-31', '2026-08-24', '2026-08-17']);
    expect(notes[0].categories[0].items).toEqual(['Newer week.']);
  });

  it('returns an empty list for no files', () => {
    expect(loadReleaseNotes({})).toEqual([]);
  });
});
