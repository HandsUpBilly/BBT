import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PlayerPanel } from './PlayerPanel';
import { humanBlocker, orcBlocker } from './test/gameState';

// vitest runs without `globals`, so Testing Library's automatic cleanup never
// registers and every render would otherwise stack up in the same document.
afterEach(cleanup);

describe('PlayerPanel', () => {
  it('carries no role caption for the ordinary single card', () => {
    const { container } = render(<PlayerPanel piece={humanBlocker()} side="right" />);

    expect(container.querySelector('.panel__role-tag')).toBeNull();
    expect(container.querySelector('.panel--acting')).toBeNull();
  });

  it('labels the two halves of a comparison so the cards are told apart', () => {
    const { container: acting } = render(
      <PlayerPanel piece={humanBlocker()} side="right" role="acting" />,
    );
    expect(acting.querySelector('.panel__role-tag')?.textContent).toBe('Acting');
    expect(acting.querySelector('.panel--acting')).toBeTruthy();

    cleanup();

    const { container: target } = render(
      <PlayerPanel piece={orcBlocker()} side="right" role="target" />,
    );
    expect(target.querySelector('.panel__role-tag')?.textContent).toBe('Target');
    expect(target.querySelector('.panel--target')).toBeTruthy();
  });

  it('still shows the stats being compared', () => {
    const piece = orcBlocker({ st: 4, ma: 5, ag: 3, av: 9 });
    render(<PlayerPanel piece={piece} side="right" role="target" />);

    const value = (label: string) =>
      screen.getByAltText(label).parentElement?.querySelector('.panel__stat-value')?.textContent;

    expect(value('MA')).toBe('5');
    expect(value('ST')).toBe('4');
    expect(value('AG')).toBe('3');
    expect(value('AV')).toBe('9');
  });

  it('uses the dedicated Human Blitzer portrait', () => {
    const piece = humanBlocker({ role: 'blitzer' });
    const { container } = render(<PlayerPanel piece={piece} side="right" />);

    expect(container.querySelector<HTMLImageElement>('.panel__portrait')?.src)
      .toContain('/human-blitzer-gritty.webp');
  });

  it('renders the empty placeholder without a caption', () => {
    const { container } = render(<PlayerPanel piece={null} side="right" role="target" />);

    expect(container.querySelector('.panel--empty')).toBeTruthy();
    expect(container.querySelector('.panel__role-tag')).toBeNull();
  });
});
