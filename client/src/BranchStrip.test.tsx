import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BranchStrip } from './BranchStrip';
import type { BranchStripEntry, BranchTreeBlockView } from './branchRun';

afterEach(cleanup);

const scoredBranch: BranchStripEntry = {
  id: 'L2',
  number: '1.1',
  label: 'Pushed + Down',
  path: 'Aldric ⚔ Grukk: Pushed → Sera ⚔ Dorg: Pushed + Down',
  outcomes: [
    {
      faces: ['push'],
      favor: 'attacker',
      label: 'Pushed',
      blockLabel: 'Aldric ⚔ Grukk',
    },
    {
      faces: ['defender-stumbles', 'defender-down'],
      favor: 'attacker',
      label: 'Pushed + Down',
      blockLabel: 'Sera ⚔ Dorg',
    },
  ],
  weight: 0.25,
  value: 1,
  status: 'scored',
  isViewed: false,
  canResetActivation: false,
};

const attentionBranch: BranchStripEntry = {
  ...scoredBranch,
  id: 'L3',
  number: '1.2',
  label: 'Pushed',
  path: 'Aldric ⚔ Grukk: Pushed → Sera ⚔ Dorg: Pushed',
  outcomes: [
    scoredBranch.outcomes[0],
    { ...scoredBranch.outcomes[0], blockLabel: 'Sera ⚔ Dorg' },
  ],
  status: 'needs-attention',
  isViewed: true,
  canResetActivation: true,
};

const tree: BranchTreeBlockView = {
  id: 'L0',
  blockNumber: 1,
  blockLabel: 'Aldric ⚔ Grukk',
  diceCount: 1,
  picker: 'attacker',
  states: [{
    ...scoredBranch,
    id: 'L1',
    number: '1',
    label: 'Pushed',
    path: 'Aldric ⚔ Grukk: Pushed',
    outcomes: scoredBranch.outcomes.slice(0, 1),
    status: 'continued',
    isViewed: true,
    isSelectable: false,
    canResetBranchPoint: true,
    nextBlock: {
      id: 'L1',
      blockNumber: 2,
      blockLabel: 'Sera ⚔ Dorg',
      diceCount: 2,
      picker: 'attacker',
      states: [
        { ...scoredBranch, isSelectable: true, canResetBranchPoint: true },
        { ...attentionBranch, isSelectable: true, canResetBranchPoint: true },
      ],
    },
  }],
};

function renderTree(
  onSelect = vi.fn(),
  onConcede = vi.fn(),
  onReset = vi.fn(),
  onResetToBranchPoint = vi.fn(),
) {
  return {
    ...render(
      <BranchStrip
        branches={[scoredBranch, attentionBranch]}
        tree={tree}
        deadWeight={0.1}
        score={0.5}
        onSelect={onSelect}
        onReset={onReset}
        onResetToBranchPoint={onResetToBranchPoint}
        onConcede={onConcede}
      />,
    ),
    onSelect,
    onConcede,
    onReset,
    onResetToBranchPoint,
  };
}

describe('BranchStrip game tree', () => {
  it('introduces the real universe strip and lets the player dismiss the explanation', () => {
    const onDismissSpotlight = vi.fn();
    render(
      <BranchStrip
        branches={[scoredBranch, attentionBranch]}
        tree={tree}
        deadWeight={0}
        score={0.5}
        spotlight
        onDismissSpotlight={onDismissSpotlight}
        onSelect={() => undefined}
        onReset={() => undefined}
        onResetToBranchPoint={() => undefined}
        onConcede={() => undefined}
      />,
    );

    expect(screen.getByText('This is the universe strip')).toBeTruthy();
    expect(screen.getByText('Each card is a live board created by the Block.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismissSpotlight).toHaveBeenCalledOnce();
  });

  it('nests a later block beneath the state where it occurred', () => {
    const { container, onSelect } = renderTree();

    const rows = container.querySelectorAll('.branch-strip-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector('.branch-strip-row__label')?.textContent).toBe('Block 1');
    expect(rows[0].querySelector('.branch-strip-row__block-group')?.textContent).toContain('Aldric ⚔ Grukk');
    expect(rows[1].querySelector('.branch-strip-row__label')?.textContent).toBe('Block 2');
    expect(rows[1].querySelector('.branch-strip-row__block-group')?.textContent).toContain('Sera ⚔ Dorg');

    // The parent spans both ending-universe columns, while each result of the
    // second block occupies one column directly underneath it.
    expect(container.querySelector('[data-branch-id="L1"]')?.getAttribute('data-column-span')).toBe('2');
    expect(container.querySelector('[data-branch-id="L2"]')?.getAttribute('data-column-start')).toBe('0');
    expect(container.querySelector('[data-branch-id="L3"]')?.getAttribute('data-column-start')).toBe('1');
    expect(screen.queryByText('Universe 1.1 — Pushed + Down')).toBeNull();
    expect(screen.queryByText('Universe 1.2 — Pushed')).toBeNull();
    expect(container.querySelector('[data-branch-id="L2"]')?.querySelectorAll('.branch-chip__die')).toHaveLength(2);
    const firstBlock = rows[0].querySelector('.branch-strip-row__block') as HTMLElement;
    const firstStateGrid = firstBlock.querySelector('.branch-strip-row__states') as HTMLElement;
    const secondBlock = rows[1].querySelector('.branch-strip-row__block') as HTMLElement;
    const secondStateGrid = secondBlock.querySelector('.branch-strip-row__states') as HTMLElement;
    expect(firstBlock.style.width).toBe('328px');
    expect(firstStateGrid.style.gridTemplateColumns).toBe('repeat(1, 328px)');
    expect(secondBlock.style.width).toBe('662px');
    expect(secondStateGrid.style.gridTemplateColumns).toBe('repeat(2, 328px)');
    expect(secondStateGrid.style.width).toBe(secondBlock.style.width);
    expect(secondBlock.querySelector('.branch-strip-row__block-group')?.parentElement).toBe(secondBlock);

    // The first state is structural history. Only the two current leaves can
    // select a board, so the tree cannot be used to rewind authored play.
    const unresolvedParent = screen.getByLabelText(/Aldric ⚔ Grukk: Pushed;.*Branched/);
    expect(unresolvedParent.tagName).toBe('DIV');
    expect(unresolvedParent.classList.contains('branch-chip--complete')).toBe(false);
    fireEvent.click(screen.getByRole('button', {
      name: /Aldric ⚔ Grukk: Pushed → Sera ⚔ Dorg: Pushed \+ Down/,
    }));
    expect(onSelect).toHaveBeenCalledWith('L2');
  });

  it('turns a parent green when every ending universe below it scored', () => {
    const completedAttention: BranchStripEntry = {
      ...attentionBranch,
      status: 'scored',
      canResetActivation: false,
    };
    const parent = tree.states[0];
    const completedTree: BranchTreeBlockView = {
      ...tree,
      states: [{
        ...parent,
        nextBlock: {
          ...parent.nextBlock!,
          states: [
            { ...scoredBranch, isSelectable: true, canResetBranchPoint: true },
            { ...completedAttention, isSelectable: true, canResetBranchPoint: true },
          ],
        },
      }],
    };

    render(
      <BranchStrip
        branches={[scoredBranch, completedAttention]}
        tree={completedTree}
        deadWeight={0}
        score={1}
        onSelect={() => undefined}
        onReset={() => undefined}
        onResetToBranchPoint={() => undefined}
        onConcede={() => undefined}
      />,
    );

    const completedParent = screen.getByLabelText(/Aldric ⚔ Grukk: Pushed;.*All branches scored/);
    expect(completedParent.classList.contains('branch-chip--complete')).toBe(true);
    expect(completedParent.textContent).toContain('All branches scored');

    fireEvent.click(screen.getByRole('button', { name: 'Collapse completed branches (2)' }));
    expect(screen.getByText('All completed branches are collapsed.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show completed branches (2)' })).toBeTruthy();
  });

  it('switches to an unfinished universe when the viewed completed branch is collapsed', () => {
    const onSelect = vi.fn();
    const viewedScored = { ...scoredBranch, isViewed: true };
    const waitingBranch = { ...attentionBranch, isViewed: false };
    render(
      <BranchStrip
        branches={[viewedScored, waitingBranch]}
        tree={tree}
        deadWeight={0}
        score={0.25}
        onSelect={onSelect}
        onReset={() => undefined}
        onResetToBranchPoint={() => undefined}
        onConcede={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Collapse completed branches (1)' }));

    expect(onSelect).toHaveBeenCalledWith(waitingBranch.id);
    expect(screen.queryByRole('button', {
      name: /Sera ⚔ Dorg: Pushed \+ Down;.*Scored/,
    })).toBeNull();
    expect(screen.getByRole('button', {
      name: /Sera ⚔ Dorg: Pushed;.*Needs a plan/,
    })).toBeTruthy();
  });

  it('can hide branches needing extra actions without giving them up', () => {
    const { onSelect, onConcede } = renderTree();

    fireEvent.click(screen.getByRole('button', {
      name: 'Hide branches needing extra actions (1)',
    }));

    expect(screen.queryByRole('button', { name: /Sera ⚔ Dorg: Pushed;.*Needs a plan/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Show branches needing extra actions (1)' })).toBeTruthy();
    // The viewed branch would disappear, so the component switches the pitch
    // to the first still-visible leaf. Filtering never concedes anything.
    expect(onSelect).toHaveBeenCalledWith('L2');
    expect(onConcede).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', {
      name: 'Show branches needing extra actions (1)',
    }));
    expect(screen.getByRole('button', { name: /Sera ⚔ Dorg: Pushed;.*Needs a plan/ })).toBeTruthy();
  });

  it('confirms before giving up a universe', () => {
    const { onConcede } = renderTree();

    const giveUpButton = screen.getByRole('button', {
      name: `Give up on ${attentionBranch.path}`,
    });
    expect(giveUpButton.textContent).toBe('⚐');
    fireEvent.click(giveUpButton);

    expect(onConcede).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog', {
      name: `Give up on Universe ${attentionBranch.number}?`,
    })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Give Up' }));
    expect(onConcede).toHaveBeenCalledOnce();
    expect(onConcede).toHaveBeenCalledWith(attentionBranch.id);
  });

  it('offers a reset for an inherited partial move', () => {
    const { onReset } = renderTree();

    fireEvent.click(screen.getByRole('button', {
      name: `Reset partial move in Universe ${attentionBranch.number}`,
    }));

    expect(onReset).toHaveBeenCalledWith(attentionBranch.id);
  });

  it('confirms before resetting a parent and warns that child branches are removed', () => {
    const onResetToBranchPoint = vi.fn();
    renderTree(vi.fn(), vi.fn(), vi.fn(), onResetToBranchPoint);

    const resetButton = screen.getByRole('button', {
      name: 'Reset Universe 1 to its branching point',
    });
    expect(resetButton.textContent).toBe('↺');
    fireEvent.click(resetButton);

    expect(onResetToBranchPoint).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog', { name: 'Reset Universe 1?' })).toBeTruthy();
    expect(screen.getByText(/removes 2 child branches/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Reset Branch' }));
    expect(onResetToBranchPoint).toHaveBeenCalledWith('L1');
  });
});
