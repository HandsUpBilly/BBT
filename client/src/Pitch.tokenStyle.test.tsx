import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Pitch } from './Pitch';
import { humanBlocker, makeState } from './test/gameState';
import type { MoveLogEntry } from './types';

afterEach(cleanup);

const noop = () => undefined;
const state = makeState([humanBlocker({ role: 'lineman' })]);

describe('Pitch token style', () => {
  it('defaults to the portrait class and hides the role code', () => {
    const { container } = render(
      <Pitch state={state} onSquareClick={noop} onPieceClick={noop} onSquareHover={noop} onSquareLeave={noop} />,
    );

    expect(container.querySelector('.pitch--simple')).toBeNull();
    expect(container.querySelector('.piece__role-code')?.textContent).toBe('LI');
    expect(container.querySelector('.piece__portrait')).toBeTruthy();
  });

  it('adds the tactical class with a positional glyph without removing the skill-marker/ring layer', () => {
    const { container } = render(
      <Pitch
        state={state}
        onSquareClick={noop}
        onPieceClick={noop}
        onSquareHover={noop}
        onSquareLeave={noop}
        tokenStyle="simple"
      />,
    );

    expect(container.querySelector('.pitch--simple')).toBeTruthy();
    // The role code is always rendered — CSS (not a second render path) decides
    // whether it or the portrait is visible — see the note in Pitch.tsx.
    expect(container.querySelector('.piece__role-code')?.textContent).toBe('LI');
    expect(container.querySelector('.piece__role-glyph--shield')).toBeTruthy();
    expect(container.querySelector('.piece__portrait')).toBeTruthy();
    expect(container.querySelector('.piece__portrait-frame')).toBeTruthy();
  });

  it('adds the plain modifier on top of the role-disc style', () => {
    const { container } = render(
      <Pitch
        state={state}
        onSquareClick={noop}
        onPieceClick={noop}
        onSquareHover={noop}
        onSquareLeave={noop}
        tokenStyle="plain"
      />,
    );

    expect(container.querySelector('.pitch--simple.pitch--plain')).toBeTruthy();
    expect(container.querySelector('.piece__role-code')?.textContent).toBe('LI');
  });
});

describe('Pitch roll dice', () => {
  it('keeps committed dice visible above the player now occupying their square', () => {
    const player = humanBlocker({ position: { col: 7, row: 11 } });
    const move: MoveLogEntry = {
      kind: 'move',
      pieceName: player.name,
      pieceRole: player.role ?? 'blocker',
      from: { col: 7, row: 10 },
      to: player.position,
      steps: 1,
      dodgeTarget: 3,
      isGfi: true,
      pickupTarget: 4,
      actionProb: 0.25,
      cumulativeProb: 0.25,
    };
    const occupiedState = { ...makeState([player]), actionLog: [move] };

    const { container } = render(
      <Pitch state={occupiedState} onSquareClick={noop} onPieceClick={noop} onSquareHover={noop} onSquareLeave={noop} />,
    );

    const square = container.querySelector('[data-square="11H"]');
    expect(square?.querySelector('.piece')).toBeTruthy();
    expect(square?.querySelector('.square__dice')).toBeTruthy();
    expect(square?.getAttribute('aria-label')).toContain('Go For It 2 plus');
    expect(square?.getAttribute('aria-label')).toContain('dodge 3 plus');
    expect(square?.getAttribute('aria-label')).toContain('pickup 4 plus');
  });

  it('identifies each roll and target on hover', () => {
    const previewState = {
      ...state,
      pathPreview: [{
        pos: { col: 7, row: 11 },
        requiresDodge: true,
        dodgeTarget: 3,
        isGfi: true,
        pickupTarget: 4,
      }],
    };

    const { getByTitle } = render(
      <Pitch state={previewState} onSquareClick={noop} onPieceClick={noop} onSquareHover={noop} onSquareLeave={noop} />,
    );

    expect(getByTitle('Go For It roll: 2+')).toBeTruthy();
    expect(getByTitle('Dodge roll: 3+')).toBeTruthy();
    expect(getByTitle('Pick-up roll: 4+')).toBeTruthy();
  });
});
