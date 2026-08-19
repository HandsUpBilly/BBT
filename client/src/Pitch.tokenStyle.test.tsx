import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Pitch } from './Pitch';
import { humanBlocker, makeState, orcBlocker } from './test/gameState';
import type { BlockLogEntry, HandoffLogEntry, MoveLogEntry, PassCatchLogEntry, PassLogEntry } from './types';

afterEach(cleanup);

const noop = () => undefined;
const state = makeState([humanBlocker({ role: 'lineman' })]);

describe('Pitch token style', () => {
  it('defaults to the portrait class and hides the role code', () => {
    const { container } = render(
      <Pitch state={state} onSquareClick={noop} onPieceClick={noop} onSquareHover={noop} onSquareLeave={noop} />,
    );

    expect(container.querySelector('.pitch--detailed')).toBeTruthy();
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

    expect(container.querySelector('.pitch--tactical.pitch--simple')).toBeTruthy();
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

    expect(container.querySelector('.pitch--plain.pitch--simple')).toBeTruthy();
    expect(container.querySelector('.piece__role-code')?.textContent).toBe('LI');
  });

  it('applies the selected pitch surface independently of token detail', () => {
    const { container } = render(
      <Pitch
        state={state}
        onSquareClick={noop}
        onPieceClick={noop}
        onSquareHover={noop}
        onSquareLeave={noop}
        tokenStyle="plain"
        pitchSurface="slate"
      />,
    );

    expect(container.querySelector('.pitch--plain.pitch--surface-slate')).toBeTruthy();
  });

  it('removes visible coordinate gutters without changing square names', () => {
    const { container } = render(
      <Pitch
        state={state}
        onSquareClick={noop}
        onPieceClick={noop}
        onSquareHover={noop}
        onSquareLeave={noop}
        showCoordinates={false}
      />,
    );

    expect(container.querySelector('.pitch--coordinates-hidden')).toBeTruthy();
    expect(container.querySelector('.pitch__col-labels')).toBeNull();
    expect(container.querySelector('[data-square="10H"]')).toBeTruthy();
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
    expect(square?.getAttribute('aria-label')).toContain('Rush 2 plus');
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

    expect(getByTitle('Rush roll: 2+')).toBeTruthy();
    expect(getByTitle('Dodge roll: 3+')).toBeTruthy();
    expect(getByTitle('Pick-up roll: 4+')).toBeTruthy();
  });
});

describe('Pitch block dice marker', () => {
  it('shows the resolved outcome on the defender square, above the piece', () => {
    const defender = orcBlocker({ position: { col: 7, row: 9 } });
    const block: BlockLogEntry = {
      kind: 'block',
      isBlitz: false,
      pieceName: 'Aldric Swiftfoot',
      pieceRole: 'blocker',
      receiverName: defender.name,
      receiverRole: defender.role ?? 'blocker',
      from: { col: 7, row: 10 },
      to: defender.position,
      diceCount: 2,
      picker: 'attacker',
      outcomeProbs: { 'attacker-down': 0, 'both-down': 0, push: 1, 'defender-stumbles': 0, 'defender-down': 0 },
      acceptedFaces: ['push'],
      resolvedFace: 'push',
      actionProb: 1,
      cumulativeProb: 1,
      dodgeTarget: null,
      isGfi: false,
    };
    const blockedState = { ...makeState([humanBlocker(), defender]), actionLog: [block] };

    const { container } = render(
      <Pitch state={blockedState} onSquareClick={noop} onPieceClick={noop} onSquareHover={noop} onSquareLeave={noop} />,
    );

    const square = container.querySelector('[data-square="9H"]');
    const marker = square?.querySelector('.square__block-dice');
    expect(marker).toBeTruthy();
    // diceCount 2 in the fixture: the marker draws one icon per die rolled.
    expect(marker?.querySelectorAll('.block-die-icon')).toHaveLength(2);
    expect(marker?.getAttribute('title')).toBe('Block: Push Back');
    expect(square?.getAttribute('aria-label')).toContain('block result: Push Back');
  });

  it('clears once the block entry is rolled back out of the action log', () => {
    const defender = orcBlocker({ position: { col: 7, row: 9 } });
    const stateWithoutBlock = makeState([humanBlocker(), defender]);

    const { container } = render(
      <Pitch state={stateWithoutBlock} onSquareClick={noop} onPieceClick={noop} onSquareHover={noop} onSquareLeave={noop} />,
    );

    const square = container.querySelector('[data-square="9H"]');
    expect(square?.querySelector('.square__block-dice')).toBeNull();
  });
});

describe('Pitch movement trail start marker', () => {
  it('numbers the square a piece first moved from, in activation order', () => {
    const first: MoveLogEntry = {
      kind: 'move',
      pieceName: 'Aldric',
      pieceRole: 'blocker',
      from: { col: 2, row: 3 },
      to: { col: 2, row: 4 },
      steps: 1,
      dodgeTarget: null,
      isGfi: false,
      actionProb: 1,
      cumulativeProb: 1,
    };
    const second: MoveLogEntry = {
      kind: 'move',
      pieceName: 'Brogar',
      pieceRole: 'lineman',
      from: { col: 5, row: 3 },
      to: { col: 5, row: 4 },
      steps: 1,
      dodgeTarget: null,
      isGfi: false,
      actionProb: 1,
      cumulativeProb: 1,
    };
    const trailState = { ...makeState([humanBlocker()]), actionLog: [first, second] };

    const { container } = render(
      <Pitch state={trailState} onSquareClick={noop} onPieceClick={noop} onSquareHover={noop} onSquareLeave={noop} />,
    );

    const firstStart = container.querySelector('[data-square="3C"]');
    expect(firstStart?.querySelector('.trail-start-marker')?.textContent).toBe('1');
    expect(firstStart?.getAttribute('aria-label')).toContain('activation order 1');

    const secondStart = container.querySelector('[data-square="3F"]');
    expect(secondStart?.querySelector('.trail-start-marker')?.textContent).toBe('2');

    // Squares stepped into (not the starting square) get no marker.
    const stepped = container.querySelector('[data-square="4C"]');
    expect(stepped?.querySelector('.trail-start-marker')).toBeNull();
  });

  it('is suppressed once another piece occupies the starting square', () => {
    const mover: MoveLogEntry = {
      kind: 'move',
      pieceName: 'Aldric',
      pieceRole: 'blocker',
      from: { col: 7, row: 10 },
      to: { col: 7, row: 11 },
      steps: 1,
      dodgeTarget: null,
      isGfi: false,
      actionProb: 1,
      cumulativeProb: 1,
    };
    const occupier = humanBlocker({ position: { col: 7, row: 10 } });
    const occupiedState = { ...makeState([occupier]), actionLog: [mover] };

    const { container } = render(
      <Pitch state={occupiedState} onSquareClick={noop} onPieceClick={noop} onSquareHover={noop} onSquareLeave={noop} />,
    );

    const square = container.querySelector('[data-square="10H"]');
    expect(square?.querySelector('.piece')).toBeTruthy();
    expect(square?.querySelector('.trail-start-marker')).toBeNull();
  });
});

describe('Pitch pass and catch dice', () => {
  it('shows a teal pass die on the passer\'s square, not the target square', () => {
    const pass: PassLogEntry = {
      kind: 'pass',
      pieceName: 'Thrower',
      pieceRole: 'thrower',
      receiverName: 'Catcher',
      receiverRole: 'catcher',
      from: { col: 7, row: 8 },
      to: { col: 7, row: 12 },
      passTarget: 3,
      rangeBand: 'short',
      actionProb: 2 / 3,
      cumulativeProb: 2 / 3,
      dodgeTarget: null,
      isGfi: false,
    };

    const { container, getByTitle } = render(
      <Pitch state={{ ...state, actionLog: [pass] }} onSquareClick={noop} onPieceClick={noop} onSquareHover={noop} onSquareLeave={noop} />,
    );

    const passerSquare = container.querySelector('[data-square="8H"]');
    expect(passerSquare?.querySelector('.pass-die')).toBeTruthy();
    expect(getByTitle('Pass roll: 3+')).toBeTruthy();
    expect(passerSquare?.getAttribute('aria-label')).toContain('pass 3 plus');

    const targetSquare = container.querySelector('[data-square="12H"]');
    expect(targetSquare?.querySelector('.pass-die')).toBeNull();
  });

  it('shows a magenta catch die on the receiver square, distinct from the pass die', () => {
    const passCatch: PassCatchLogEntry = {
      kind: 'pass-catch',
      pieceName: 'Catcher',
      pieceRole: 'catcher',
      from: { col: 7, row: 12 },
      to: { col: 7, row: 12 },
      catchTarget: 2,
      actionProb: 5 / 6,
      cumulativeProb: 5 / 6,
      dodgeTarget: null,
      isGfi: false,
    };

    const { container, getByTitle } = render(
      <Pitch state={{ ...state, actionLog: [passCatch] }} onSquareClick={noop} onPieceClick={noop} onSquareHover={noop} onSquareLeave={noop} />,
    );

    const square = container.querySelector('[data-square="12H"]');
    expect(square?.querySelector('.catch-die')).toBeTruthy();
    expect(square?.querySelector('.pass-die')).toBeNull();
    expect(getByTitle('Catch roll: 2+')).toBeTruthy();
    expect(square?.getAttribute('aria-label')).toContain('catch 2 plus');
  });

  it('reuses the catch die for a hand-off, the same Agility test as a pass-catch', () => {
    const handoff: HandoffLogEntry = {
      kind: 'handoff',
      pieceName: 'Carrier',
      pieceRole: 'blocker',
      receiverName: 'Receiver',
      receiverRole: 'lineman',
      from: { col: 6, row: 12 },
      to: { col: 7, row: 12 },
      catchTarget: 2,
      actionProb: 5 / 6,
      cumulativeProb: 5 / 6,
      dodgeTarget: null,
      isGfi: false,
    };

    const { container } = render(
      <Pitch state={{ ...state, actionLog: [handoff] }} onSquareClick={noop} onPieceClick={noop} onSquareHover={noop} onSquareLeave={noop} />,
    );

    const square = container.querySelector('[data-square="12H"]');
    expect(square?.querySelector('.catch-die')).toBeTruthy();
  });

  it('splits the pass die onto the passer and the catch die onto the receiver for one throw', () => {
    const pass: PassLogEntry = {
      kind: 'pass',
      pieceName: 'Thrower',
      pieceRole: 'thrower',
      receiverName: 'Catcher',
      receiverRole: 'catcher',
      from: { col: 7, row: 8 },
      to: { col: 7, row: 12 },
      passTarget: 3,
      rangeBand: 'short',
      actionProb: 2 / 3,
      cumulativeProb: 2 / 3,
      dodgeTarget: null,
      isGfi: false,
    };
    const passCatch: PassCatchLogEntry = {
      kind: 'pass-catch',
      pieceName: 'Catcher',
      pieceRole: 'catcher',
      from: { col: 7, row: 12 },
      to: { col: 7, row: 12 },
      catchTarget: 2,
      actionProb: 5 / 6,
      cumulativeProb: 5 / 6,
      dodgeTarget: null,
      isGfi: false,
    };

    const { container } = render(
      <Pitch state={{ ...state, actionLog: [pass, passCatch] }} onSquareClick={noop} onPieceClick={noop} onSquareHover={noop} onSquareLeave={noop} />,
    );

    const passerSquare = container.querySelector('[data-square="8H"]');
    expect(passerSquare?.querySelector('.pass-die')).toBeTruthy();
    expect(passerSquare?.querySelector('.catch-die')).toBeNull();

    const receiverSquare = container.querySelector('[data-square="12H"]');
    expect(receiverSquare?.querySelector('.catch-die')).toBeTruthy();
    expect(receiverSquare?.querySelector('.pass-die')).toBeNull();
  });
});

describe('Pitch completed pass trajectory', () => {
  it('keeps a curved throw line visible from the action log', () => {
    const pass: PassLogEntry = {
      kind: 'pass',
      pieceName: 'Thrower',
      pieceRole: 'thrower',
      receiverName: 'Catcher',
      receiverRole: 'catcher',
      from: { col: 7, row: 8 },
      to: { col: 7, row: 12 },
      passTarget: 3,
      rangeBand: 'short',
      actionProb: 2 / 3,
      cumulativeProb: 2 / 3,
      dodgeTarget: null,
      isGfi: false,
    };

    const { container } = render(
      <Pitch
        state={{ ...state, actionLog: [pass] }}
        onSquareClick={noop}
        onPieceClick={noop}
        onSquareHover={noop}
        onSquareLeave={noop}
      />,
    );

    const path = container.querySelector('.pitch__pass-trajectory');
    expect(path?.getAttribute('d')).toContain(' Q ');
    expect(container.querySelector('.pitch__pass-trajectories marker')).toBeTruthy();
  });
});

describe('Pitch move decision', () => {
  it('anchors accessible icon actions beside the endpoint', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const { container } = render(
      <Pitch
        state={state}
        onSquareClick={noop}
        onPieceClick={noop}
        onSquareHover={noop}
        onSquareLeave={noop}
        moveDecision={{
          position: { col: 0, row: 0 },
          probability: 42,
          onCancel,
          onConfirm,
        }}
      />,
    );

    expect(container.querySelector('.move-decision--right.move-decision--down')).toBeTruthy();
    expect(container.querySelector('.move-decision__prob')?.textContent).toBe('42%');
    const cancel = screen.getByRole('button', { name: 'Plot Again' });
    const confirm = screen.getByRole('button', { name: 'Confirm Move' });
    expect(cancel.textContent).toBe('×');
    expect(confirm.textContent).toBe('✓');
    fireEvent.click(cancel);
    fireEvent.click(confirm);
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
