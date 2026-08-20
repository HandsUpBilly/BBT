import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BranchStrip } from './BranchStrip';
import type { BranchStripEntry, BranchTreeBlockView } from './branchRun';

afterEach(cleanup);

const scoredBranch: BranchStripEntry = {
  id: 'L2',
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
};

const attentionBranch: BranchStripEntry = {
  ...scoredBranch,
  id: 'L3',
  label: 'Pushed',
  path: 'Aldric ⚔ Grukk: Pushed → Sera ⚔ Dorg: Pushed',
  outcomes: [
    scoredBranch.outcomes[0],
    { ...scoredBranch.outcomes[0], blockLabel: 'Sera ⚔ Dorg' },
  ],
  status: 'needs-attention',
  isViewed: true,
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
    label: 'Pushed',
    path: 'Aldric ⚔ Grukk: Pushed',
    outcomes: scoredBranch.outcomes.slice(0, 1),
    status: 'continued',
    isViewed: true,
    isSelectable: false,
    nextBlock: {
      id: 'L1',
      blockNumber: 2,
      blockLabel: 'Sera ⚔ Dorg',
      diceCount: 2,
      picker: 'attacker',
      states: [
        { ...scoredBranch, isSelectable: true },
        { ...attentionBranch, isSelectable: true },
      ],
    },
  }],
};

function renderTree(onSelect = vi.fn(), onConcede = vi.fn()) {
  return {
    ...render(
      <BranchStrip
        branches={[scoredBranch, attentionBranch]}
        tree={tree}
        deadWeight={0.1}
        score={0.5}
        onSelect={onSelect}
        onConcede={onConcede}
      />,
    ),
    onSelect,
    onConcede,
  };
}

describe('BranchStrip game tree', () => {
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

    // The first state is structural history. Only the two current leaves can
    // select a board, so the tree cannot be used to rewind authored play.
    expect(screen.getByLabelText(/Aldric ⚔ Grukk: Pushed;.*Branched/).tagName).toBe('DIV');
    fireEvent.click(screen.getByRole('button', {
      name: /Aldric ⚔ Grukk: Pushed → Sera ⚔ Dorg: Pushed \+ Down/,
    }));
    expect(onSelect).toHaveBeenCalledWith('L2');
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
});
