import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Pitch } from './Pitch';
import { humanBlocker, makeState } from './test/gameState';

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
