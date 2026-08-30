import { cleanup, render } from '@testing-library/react';
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
});
