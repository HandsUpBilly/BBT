import type { ReactNode } from 'react';

/**
 * Just enough Markdown for release notes: **bold** and [text](url) links.
 * Everything else (including any other Markdown syntax) is left as literal
 * text — this is not a general-purpose renderer.
 */
const TOKEN = /\*\*(.+?)\*\*|\[([^\]]+)\]\((\S+?)\)/g;

export function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of text.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) nodes.push(text.slice(lastIndex, index));

    const [whole, bold, linkText, href] = match;
    if (bold !== undefined) {
      nodes.push(<strong key={key++}>{bold}</strong>);
    } else {
      nodes.push(
        <a key={key++} href={href} target="_blank" rel="noopener noreferrer">
          {linkText}
        </a>,
      );
    }
    lastIndex = index + whole.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}
