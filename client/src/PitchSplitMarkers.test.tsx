import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BranchTreeBlockView, BranchTreeStateView } from './branchRun';
import { pitchSplitPoints, selectSplitDestination } from './pitchSplitPoints';
import { PitchSplitMarkers } from './PitchSplitMarkers';

afterEach(cleanup);

const makeState = (
  id: string, number: string, label: string, isViewed = false,
): BranchTreeStateView => ({
  id, number, label, path: label,
  outcomes: [{ faces: ['push', 'defender-stumbles'], favor: 'attacker', label, blockLabel: 'A ⚔ B' }],
  weight: 0.25, value: 0.4, status: 'authoring',
  isViewed, isSelectable: true,
  canResetActivation: false, canResetBranchPoint: false,
});

const root: BranchTreeBlockView = {
  id: 'L0', position: { col: 7, row: 10 },
  blockNumber: 1, blockLabel: 'A ⚔ B',
  diceCount: 2, picker: 'attacker',
  states: [
    makeState('L1', '1', 'Pushed', true),
    makeState('L2', '2', 'Down in place'),
  ],
};

const ranges = {
  acrossValues: Array.from({ length: 15 }, (_, i) => i),
  downValues: Array.from({ length: 26 }, (_, i) => i),
};

describe('pitch split point model', () => {
  it('derives the original block position and grouped dice outcomes', () => {
    const [split] = pitchSplitPoints(root);
    expect(split.position).toEqual({ col: 7, row: 10 });
    expect(split.choices).toHaveLength(2);
    expect(split.choices[0].faces).toEqual(['push', 'defender-stumbles']);
    expect(split.choices[0].isCurrent).toBe(true);
    expect(split.choices[1].targetId).toBe('L2');
  });

  it('navigates to a leaf rather than rewinding a historical universe', () => {
    const deep = makeState('L3', '1.1', 'Another push', true);
    const other = makeState('L4', '1.2', 'Another down');
    const nested: BranchTreeBlockView = {
      id: 'L1', position: { col: 3, row: 9 },
      blockNumber: 2, blockLabel: 'C ⚔ D', diceCount: 1, picker: 'defender',
      states: [deep, other],
    };
    const historical: BranchTreeStateView = {
      ...root.states[0], isSelectable: false, status: 'continued', nextBlock: nested,
    };
    const tree: BranchTreeBlockView = { ...root, states: [historical, root.states[1]] };

    expect(selectSplitDestination(historical)?.id).toBe('L3');
    expect(pitchSplitPoints(tree).map(point => point.id)).toEqual(['L0', 'L1']);
    expect(pitchSplitPoints(tree)[0].choices[0].targetId).toBe('L3');
    expect(pitchSplitPoints(tree)[1].choices[1].targetId).toBe('L4');
  });

  it('hides the marker until the block has split', () => {
    expect(pitchSplitPoints(null)).toEqual([]);
    expect(pitchSplitPoints({ ...root, position: undefined })).toEqual([]);
  });
});

describe('on-pitch universe selector', () => {
  it('opens dice results and selects the current descendant board without rewinding', () => {
    const onSelect = vi.fn();
    render(<PitchSplitMarkers tree={root} orientation="portrait" {...ranges} onSelect={onSelect} />);

    const toggle = screen.getByRole('button', { name: /Split 1: A ⚔ B.*2 outcomes/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    const panel = screen.getByRole('group', { name: /Split 1: A ⚔ B dice outcomes/ });
    expect(within(panel).getByText('2 dice · You choose')).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: /Down in place.*universe 2/ }));
    expect(onSelect).toHaveBeenCalledWith('L2');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes on outside pointer and Escape, without changing the universe', () => {
    const onSelect = vi.fn();
    render(<PitchSplitMarkers tree={root} orientation="portrait" {...ranges} onSelect={onSelect} />);
    const toggle = screen.getByRole('button', { name: /Split 1: A ⚔ B/ });
    fireEvent.click(toggle);
    fireEvent.pointerDown(document.body);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('places markers using the transposed pitch axes in landscape', () => {
    const { container } = render(
      <PitchSplitMarkers
        tree={root}
        orientation="landscape"
        acrossValues={Array.from({ length: 26 }, (_, i) => i)}
        downValues={Array.from({ length: 15 }, (_, i) => i)}
        onSelect={vi.fn()}
      />,
    );
    const marker = container.querySelector('.pitch-split-point') as HTMLElement;
    expect(marker.style.left).toContain('41.538');
    expect(marker.style.top).toContain('47.866');
  });
});
