import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { humanThrower, makeState } from './test/gameState';
import { TutorialMiniDiagram } from './TutorialMiniDiagram';
import type { TutorialDiagramHint } from './tutorialDiagram';

afterEach(cleanup);

describe('TutorialMiniDiagram', () => {
  it('matches the live landscape pitch instead of reversing its numbered axis', () => {
    const state = makeState([
      humanThrower({ position: { col: 0, row: 0 } }),
    ]);
    const hint: TutorialDiagramHint = {
      text: 'Move toward the end zone.',
      alt: 'The live pitch orientation.',
      focus: { kind: 'pitch', region: 'end-zone', pieceIds: ['thrower'] },
    };

    const { container } = render(<TutorialMiniDiagram state={state} hint={hint} />);

    expect(container.querySelector('.tutorial-mini-diagram__piece--focused')?.getAttribute('transform'))
      .toBe('translate(22 20)');
    expect(container.querySelector('.tutorial-mini-diagram__end-zone')?.getAttribute('x'))
      .toBe('22');
    expect(Array.from(container.querySelectorAll('.tutorial-mini-diagram__landmarks text'))
      .map(label => label.textContent)).toEqual(['0', '25', 'END ZONE']);
  });

  it('uses a dedicated full-size split graphic for Parallel Universes', () => {
    const hint: TutorialDiagramHint = {
      text: 'Accepted outcomes become separate boards.',
      alt: 'One Block splitting into three live universe cards.',
      focus: { kind: 'universes', region: 'route' },
    };

    const { container } = render(<TutorialMiniDiagram state={makeState([])} hint={hint} />);

    expect(screen.getByRole('img', { name: hint.alt })).toBeTruthy();
    expect(screen.getByText('ONE BLOCK')).toBeTruthy();
    expect(screen.getAllByText(/UNIVERSE [123]/)).toHaveLength(3);
    expect(screen.getAllByText('PLAY THIS BOARD')).toHaveLength(3);
    expect(container.querySelector('.tutorial-mini-diagram__field')).toBeNull();
  });
});
