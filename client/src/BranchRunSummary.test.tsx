import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BranchRunSummary } from './BranchRunSummary';
import {
  branchStrip,
  chooseBlockTarget,
  choosePush,
  clickSquare,
  declareBlock,
  runSummary,
  splitOnBlock,
  startRun,
} from './branchRun';
import { applyClick } from './useGameState';
import { blockOutcomeProbabilities } from './bfs';
import { makeState, humanBlocker, humanThrower, orcBlocker } from './test/gameState';
import type { Scenario } from './types';

afterEach(cleanup);

/**
 * Attacker with Block vs a plain defender, plus a carrier who can walk the
 * ball in regardless of which board state the block leaves behind — i.e. a
 * run that finishes with every branch scored, exactly what BranchRunSummary
 * expects to receive.
 */
function scoredRun() {
  const attacker = humanBlocker({ id: 'attacker', position: { col: 7, row: 10 }, skills: ['Block'] });
  const defender = orcBlocker({ id: 'defender', position: { col: 7, row: 9 } });
  const carrier = humanThrower({ id: 'carrier', position: { col: 5, row: 1 } });
  const selected = applyClick(makeState([attacker, defender, carrier]), { col: 7, row: 10 });
  const declared = {
    ...selected,
    blockChoice: {
      defenderId: 'defender', isBlitz: false, diceCount: 1 as const, picker: 'attacker' as const,
      attackerAssists: 0, defenderAssists: 0,
      outcomeProbs: blockOutcomeProbabilities(1, 'attacker'),
    },
  };

  let run = splitOnBlock(startRun(declared));
  run = choosePush(run, { col: 7, row: 8 }, false);
  run = clickSquare(run, { col: 5, row: 1 });
  run = clickSquare(run, { col: 5, row: 0 });
  return run;
}

function twoBlockScoredRun() {
  const attacker = humanBlocker({ id: 'attacker', position: { col: 7, row: 10 }, skills: ['Block'] });
  const defender = orcBlocker({ id: 'defender', position: { col: 7, row: 9 } });
  const attacker2 = humanBlocker({
    id: 'attacker2', name: 'Cedric Linebreaker', position: { col: 2, row: 10 }, skills: ['Block'],
  });
  const defender2 = orcBlocker({
    id: 'defender2', name: 'Muzgash Skullkrak', position: { col: 2, row: 9 },
  });
  const carrier = humanThrower({ id: 'carrier', position: { col: 5, row: 1 } });
  const selected = applyClick(
    makeState([attacker, defender, attacker2, defender2, carrier]),
    { col: 7, row: 10 },
  );
  const declared = {
    ...selected,
    blockChoice: {
      defenderId: 'defender', isBlitz: false, diceCount: 1 as const, picker: 'attacker' as const,
      attackerAssists: 0, defenderAssists: 0,
      outcomeProbs: blockOutcomeProbabilities(1, 'attacker'),
    },
  };

  let run = choosePush(splitOnBlock(startRun(declared)), { col: 7, row: 8 }, false);
  run = declareBlock(run, 'attacker2', false);
  run = chooseBlockTarget(run, { col: 2, row: 9 });
  run = choosePush(splitOnBlock(run), { col: 2, row: 8 }, false);
  run = clickSquare(run, { col: 5, row: 1 });
  return clickSquare(run, { col: 5, row: 0 });
}

const scenario: Scenario = {
  id: 'test-scenario',
  name: 'Test Play',
  description: '',
  activeTeam: 'human',
  pieces: [
    { id: 'attacker', team: 'human', role: 'blocker', name: 'Aldric Swiftfoot', ma: 6, st: 3, ag: 3, pa: 3, av: 8, skills: ['Block'], position: { col: 7, row: 10 }, hasBall: false },
    { id: 'defender', team: 'orc', role: 'blocker', name: 'Grukk Ironjaw', ma: 4, st: 3, ag: 3, pa: 6, av: 9, skills: [], position: { col: 7, row: 9 }, hasBall: false },
    { id: 'carrier', team: 'human', role: 'thrower', name: 'Sera Quickhand', ma: 6, st: 3, ag: 3, pa: 3, av: 8, skills: [], position: { col: 5, row: 1 }, hasBall: true },
  ],
};

function baseProps() {
  const run = scoredRun();
  return {
    scenarioName: scenario.name,
    scenario,
    run,
    summary: runSummary(run),
    branches: branchStrip(run),
    onSubmit: vi.fn(),
    onDismiss: vi.fn(),
    defaultName: 'Coach',
  };
}

describe('BranchRunSummary branch list', () => {
  it('shows compact hierarchical universe labels while retaining the full path', () => {
    render(<BranchRunSummary {...baseProps()} />);

    expect(screen.getByText('Universe 2')).toBeTruthy();
    expect(screen.getByText('Universe 3')).toBeTruthy();
    expect(screen.getByRole('button', {
      name: 'View Universe 3: Aldric Swiftfoot ⚔ Grukk Ironjaw: Pushed',
    })).toBeTruthy();
  });

  it('shows the completed game as a branch graphic', () => {
    const { container } = render(<BranchRunSummary {...baseProps()} />);

    expect(screen.getByRole('img', {
      name: 'Game branch tree with 1 block and 3 ending universes',
    })).toBeTruthy();
    expect(screen.getByText('Game branches')).toBeTruthy();
    expect(screen.getByText('Block 1')).toBeTruthy();
    expect(screen.getByText('3 — Pushed')).toBeTruthy();
    expect(container.querySelectorAll('.branch-tree__node--block')).toHaveLength(0);
    expect(container.querySelectorAll('.branch-tree__column-label')).toHaveLength(1);
  });

  it('lays out a multi-block run as two block depths and all ending universes', () => {
    const run = twoBlockScoredRun();
    const { container } = render(
      <BranchRunSummary
        {...baseProps()}
        run={run}
        summary={runSummary(run)}
        branches={branchStrip(run)}
      />,
    );

    expect(screen.getByRole('img', {
      name: 'Game branch tree with 2 blocks and 9 ending universes',
    })).toBeTruthy();
    expect(container.querySelectorAll('.branch-tree__column-label')).toHaveLength(2);
    expect([...container.querySelectorAll('.branch-tree__column-label')].map(label => label.textContent))
      .toEqual(['Block 1', 'Block 2']);
    expect(container.querySelectorAll('.branch-tree__node--block')).toHaveLength(0);
    expect(screen.getByText('Universe 1.1')).toBeTruthy();
  });

  it('opens a branch\'s own action summary and play diagram on click', () => {
    const { container } = render(<BranchRunSummary {...baseProps()} />);

    // Exact match: "Pushed" alone would also match the "Pushed + Down" row.
    fireEvent.click(screen.getByRole('button', {
      name: 'View Universe 3: Aldric Swiftfoot ⚔ Grukk Ironjaw: Pushed',
    }));

    // Detail view: the visual heading stays short while its accessible name
    // retains the full branch path. The summary body is gone, and the play
    // diagram + move table (ActionLogDetail) are in its place — this branch's
    // own block, resolved as a Push Back, shows up as a row.
    const detailTitle = screen.getByRole('heading', {
      name: 'Universe 3: Aldric Swiftfoot ⚔ Grukk Ironjaw: Pushed',
    });
    expect(detailTitle.textContent).toBe('Universe 3 Pushed');
    expect(screen.getByText('Universe review')).toBeTruthy();
    expect(screen.getByText('Aldric Swiftfoot ⚔ Grukk Ironjaw: Pushed')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Decision log' })).toBeTruthy();
    expect(screen.queryByText(/run complete/)).toBeNull();
    expect(screen.getByText('Block → Push Back')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Back to summary/ })).toBeTruthy();
    expect(screen.getByRole('img', { name: /Completed play/ })).toBeTruthy();
    expect(screen.getByRole('img', {
      name: 'Game branch tree with 1 block and 3 ending universes; reviewed branch highlighted',
    })).toBeTruthy();
    expect(screen.getByTestId('branch-detail-scroll')).toBeTruthy();
    expect(container.querySelectorAll('.action-log-detail__diagrams--paired > figure')).toHaveLength(2);
    expect(container.querySelectorAll('.branch-review__node--selected')).toHaveLength(1);
    expect(container.querySelectorAll('.branch-review__node--highlighted')).toHaveLength(1);
    // Every node carries its dice result; the selected Push node has one die.
    expect(container.querySelectorAll('.branch-review__die')).toHaveLength(4);
    expect(container.querySelectorAll('.branch-review__node--selected .branch-review__die')).toHaveLength(1);
    expect(container.querySelectorAll('.branch-review__edge--highlighted')).toHaveLength(1);
  });

  it('highlights the reviewed leaf and its full ancestry through multiple blocks', () => {
    const run = twoBlockScoredRun();
    const { container } = render(
      <BranchRunSummary
        {...baseProps()}
        run={run}
        summary={runSummary(run)}
        branches={branchStrip(run)}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: /^View / })[0]);

    expect(container.querySelectorAll('.branch-review__node--selected')).toHaveLength(1);
    expect(container.querySelectorAll('.branch-review__node--highlighted')).toHaveLength(2);
    expect(container.querySelectorAll('.branch-review__edge--highlighted')).toHaveLength(2);
  });

  it('returns to the summary and its submit controls on Back', () => {
    const props = baseProps();
    render(<BranchRunSummary {...props} />);

    fireEvent.click(screen.getAllByRole('button', { name: /^View / })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Back to summary/ }));

    expect(screen.getByText(/run complete/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Submit Score' })).toBeTruthy();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });
});
