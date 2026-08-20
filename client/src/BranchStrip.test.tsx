import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BranchStrip } from './BranchStrip';
import type { BranchStripEntry } from './branchRun';

afterEach(cleanup);

const branch: BranchStripEntry = {
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
  isViewed: true,
};

describe('BranchStrip permutation cards', () => {
  it('renders every block in a separate labelled row', () => {
    const { container } = render(
      <BranchStrip
        branches={[branch, { ...branch, id: 'L3', isViewed: false }]}
        deadWeight={0.1}
        score={0.5}
        onSelect={vi.fn()}
        onConcede={vi.fn()}
      />,
    );

    const firstCard = container.querySelector('.branch-chip');
    const rows = firstCard?.querySelectorAll('.branch-chip__block');
    expect(rows).toHaveLength(2);
    expect(rows?.[0].textContent).toContain('Block 1');
    expect(rows?.[0].textContent).toContain('Pushed');
    expect(rows?.[1].textContent).toContain('Block 2');
    expect(rows?.[1].textContent).toContain('Pushed + Down');
    expect(rows?.[0].getAttribute('title')).toBe('Aldric ⚔ Grukk: Pushed');
    expect(rows?.[1].getAttribute('title')).toBe('Sera ⚔ Dorg: Pushed + Down');
  });
});
