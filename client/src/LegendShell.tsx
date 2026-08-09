import type { ReactNode } from 'react';

interface Props {
  /** Wrap the legend in a disclosure instead of showing it inline. */
  collapsible: boolean;
  children: ReactNode;
}

/**
 * The pitch legend, optionally behind a disclosure.
 *
 * Inline on a desktop, where the horizontal room is free. On a phone the same
 * markup costs 53–61px of permanent vertical space to explain colours — about
 * a fifth of what the board itself gets — and it is reference material a
 * player consults once, not a readout they track. `<details>` rather than a
 * hand-rolled toggle so it keeps its keyboard behaviour and exposes the
 * expanded state to assistive technology for free.
 */
export function LegendShell({ collapsible, children }: Props) {
  if (!collapsible) {
    return <div className="game-legends">{children}</div>;
  }

  return (
    <details className="game-legends game-legends--collapsible">
      <summary className="game-legends__summary">Key</summary>
      <div className="game-legends__body">{children}</div>
    </details>
  );
}
