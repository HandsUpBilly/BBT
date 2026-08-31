import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PlayDiagram } from './PlayDiagram';
import { buildMovementRoutes } from './playDiagramRoutes';
import type { ActionLogEntry, Scenario } from './types';

const scenario: Scenario = {
  id: 'diagram-test',
  name: 'Diagram Test',
  description: 'A completed play.',
  activeTeam: 'human',
  pieces: [
    {
      id: 'runner', team: 'human', role: 'catcher', name: 'Runner',
      ma: 7, st: 3, ag: 3, pa: 4, av: 8, skills: [],
      position: { col: 7, row: 6 }, hasBall: true,
    },
    {
      id: 'thrower', team: 'human', role: 'thrower', name: 'Thrower',
      ma: 6, st: 3, ag: 3, pa: 3, av: 8, skills: ['Pass'],
      position: { col: 8, row: 5 }, hasBall: false,
    },
    {
      id: 'defender', team: 'orc', role: 'lineman', name: 'Defender',
      ma: 5, st: 3, ag: 3, pa: 4, av: 9, skills: [],
      position: { col: 6, row: 10 }, hasBall: false,
    },
  ],
};

const actionLog: ActionLogEntry[] = [
  {
    kind: 'move', pieceName: 'Runner', pieceRole: 'catcher',
    from: { col: 7, row: 6 }, to: { col: 7, row: 7 }, steps: 1,
    dodgeTarget: null, isGfi: false, actionProb: 1, cumulativeProb: 1,
  },
  {
    kind: 'move', pieceName: 'Runner', pieceRole: 'catcher',
    from: { col: 7, row: 7 }, to: { col: 7, row: 8 }, steps: 1,
    dodgeTarget: null, isGfi: false, actionProb: 1, cumulativeProb: 1,
  },
  {
    kind: 'pass', pieceName: 'Thrower', pieceRole: 'thrower',
    receiverName: 'Runner', receiverRole: 'catcher',
    from: { col: 8, row: 5 }, to: { col: 7, row: 8 },
    passTarget: 3, rangeBand: 'quick', dodgeTarget: null, isGfi: false,
    actionProb: 2 / 3, cumulativeProb: 2 / 3,
  },
  {
    kind: 'pass-catch', pieceName: 'Runner', pieceRole: 'catcher',
    from: { col: 7, row: 8 }, to: { col: 7, row: 8 },
    catchTarget: 3, dodgeTarget: null, isGfi: false,
    actionProb: 2 / 3, cumulativeProb: 4 / 9,
  },
  {
    kind: 'block', isBlitz: false, pieceName: 'Runner', pieceRole: 'catcher',
    receiverName: 'Defender', receiverRole: 'lineman',
    from: { col: 7, row: 9 }, to: { col: 6, row: 10 }, diceCount: 1,
    picker: 'attacker', outcomeProbs: {
      'attacker-down': 1 / 6, 'both-down': 1 / 6, push: 1 / 6,
      'defender-stumbles': 1 / 6, 'defender-down': 1 / 6,
    },
    acceptedFaces: ['push'], resolvedFace: 'push', dodgeTarget: null, isGfi: false,
    actionProb: 1 / 6, cumulativeProb: 2 / 27,
  },
];

afterEach(cleanup);

describe('buildMovementRoutes', () => {
  it('joins contiguous committed steps and starts a new route after a gap', () => {
    const separatedStep: ActionLogEntry = {
      kind: 'move', pieceName: 'Runner', pieceRole: 'catcher',
      from: { col: 5, row: 12 }, to: { col: 5, row: 13 }, steps: 1,
      dodgeTarget: null, isGfi: false, actionProb: 1, cumulativeProb: 1,
    };

    const routes = buildMovementRoutes([...actionLog, separatedStep]);

    expect(routes).toEqual([
      {
        pieceName: 'Runner',
        points: [{ col: 7, row: 6 }, { col: 7, row: 7 }, { col: 7, row: 8 }],
      },
      {
        pieceName: 'Runner',
        points: [{ col: 5, row: 12 }, { col: 5, row: 13 }],
      },
    ]);
  });
});

describe('PlayDiagram', () => {
  it('renders the starting formation and the actions from this completed run', () => {
    const { container } = render(<PlayDiagram scenario={scenario} actionLog={actionLog} />);

    expect(screen.getByRole('img', { name: /1 movement route, 1 pass, 1 block/i })).toBeTruthy();
    expect(container.querySelectorAll('.play-diagram__player--active')).toHaveLength(2);
    expect(container.querySelectorAll('.play-diagram__player--opposition')).toHaveLength(1);
    expect(container.querySelectorAll('[data-route-kind="movement"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-route-kind="pass"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-route-kind="handoff"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-route-kind="block"]')).toHaveLength(1);
    expect(container.querySelector('.play-diagram__ball')).not.toBeNull();

    // The diagram follows the live landscape pitch: state rows increase to
    // the right and state columns increase down the page.
    expect(container.querySelector('[data-route-kind="movement"]')?.getAttribute('points'))
      .toBe('148,168 168,168 188,168');
  });

  it('keeps a human scoring route at the left end of the landscape review', () => {
    const humanScore: ActionLogEntry[] = [{
      kind: 'move', pieceName: 'Runner', pieceRole: 'catcher',
      from: { col: 14, row: 1 }, to: { col: 14, row: 0 }, steps: 1,
      dodgeTarget: null, isGfi: false, actionProb: 1, cumulativeProb: 1,
    }];

    const { container } = render(<PlayDiagram scenario={scenario} actionLog={humanScore} />);

    expect(container.querySelector('[data-route-kind="movement"]')?.getAttribute('points'))
      .toBe('48,308 28,308');
  });
});
