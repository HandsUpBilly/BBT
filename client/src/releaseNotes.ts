/**
 * Weekly release notes, written to `docs/release-notes/YYYY-MM-DD.md` by a
 * scheduled routine and bundled at build time — see ReleaseNotesDialog.tsx
 * for the "under the version in About" entry point.
 *
 * Parsing is deliberately lenient (the routine is a fresh AI session each
 * week, not a schema-checked form): any `## Heading` becomes a category, any
 * `- ` line under it becomes an item, and headings with no items are
 * dropped. Expected categories are New, Improved, Fixed and Breaking, in
 * that order; anything else sorts after them in the order first seen.
 */

export interface ReleaseNoteCategory {
  name: string;
  items: string[];
}

export interface ReleaseNote {
  /** YYYY-MM-DD, taken from the file name rather than parsed from content. */
  date: string;
  title: string;
  summary?: string;
  categories: ReleaseNoteCategory[];
}

const CATEGORY_ORDER = ['New', 'Improved', 'Fixed', 'Breaking'];

function categoryRank(name: string): number {
  const index = CATEGORY_ORDER.findIndex(candidate => candidate.toLowerCase() === name.toLowerCase());
  return index === -1 ? CATEGORY_ORDER.length : index;
}

export function formatReleaseNoteDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

export function parseReleaseNote(date: string, markdown: string): ReleaseNote {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let title = formatReleaseNoteDate(date);
  let index = 0;
  if (lines[0]?.startsWith('# ')) {
    title = lines[0].slice(2).trim();
    index = 1;
  }

  const summaryLines: string[] = [];
  while (index < lines.length && !lines[index].startsWith('## ')) {
    if (lines[index].trim()) summaryLines.push(lines[index].trim());
    index += 1;
  }

  const categories: ReleaseNoteCategory[] = [];
  let current: ReleaseNoteCategory | null = null;
  for (; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith('## ')) {
      current = { name: line.slice(3).trim(), items: [] };
      categories.push(current);
      continue;
    }
    const trimmed = line.trim();
    const bullet = /^[-*]\s+(.*)/.exec(trimmed);
    if (bullet && current) {
      current.items.push(bullet[1].trim());
    } else if (current && trimmed && current.items.length > 0) {
      // A soft-wrapped continuation of the previous bullet, not a new one.
      const lastIndex = current.items.length - 1;
      current.items[lastIndex] = `${current.items[lastIndex]} ${trimmed}`;
    }
  }

  return {
    date,
    title,
    summary: summaryLines.join(' ') || undefined,
    categories: categories
      .filter(category => category.items.length > 0)
      .sort((a, b) => categoryRank(a.name) - categoryRank(b.name)),
  };
}

const FILENAME_DATE = /(\d{4}-\d{2}-\d{2})\.md$/;

export function loadReleaseNotes(modules: Record<string, string>): ReleaseNote[] {
  return Object.entries(modules)
    .map(([path, content]) => {
      const match = FILENAME_DATE.exec(path);
      return parseReleaseNote(match ? match[1] : path, content);
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

// Bundled at build time, same pattern as client/src/scenarios/index.ts. An
// empty docs/release-notes/ directory (e.g. before the routine's first run)
// simply glob-matches nothing rather than failing the build.
const modules = import.meta.glob<string>('../../docs/release-notes/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
});

export const releaseNotes: ReleaseNote[] = loadReleaseNotes(modules);
