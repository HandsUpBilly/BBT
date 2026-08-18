import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Scenario } from '../types';
import { PuzzleEditor } from './PuzzleEditor';

const savedScenario: Scenario = {
  id: 'scenario-001',
  name: 'Saved Puzzle',
  description: 'The saved description.',
  activeTeam: 'human',
  published: true,
  ballPosition: null,
  pieces: [{
    id: 'human-1',
    team: 'human',
    role: 'lineman',
    name: 'Aldric',
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 8,
    skills: [],
    position: { col: 7, row: 7 },
    hasBall: true,
  }],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderEditor() {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      scenarios: [savedScenario],
      series: {
        id: 'default',
        name: 'Tutorial',
        description: '',
        scenarioIds: ['scenario-001'],
      },
    }),
  });
  vi.stubGlobal('fetch', fetchMock);
  render(
    <PuzzleEditor
      onBack={vi.fn()}
      onPlay={vi.fn()}
      previewScenario={null}
      idToken="admin-token"
    />,
  );
  return fetchMock;
}

describe('PuzzleEditor unsaved changes', () => {
  it('can discard edits and restore the last saved draft without an API write', async () => {
    const fetchMock = renderEditor();

    const nameInput = await screen.findByDisplayValue('Saved Puzzle');
    const discard = screen.getByRole('button', { name: 'Discard Unsaved Changes' });
    expect((discard as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(nameInput, { target: { value: 'Unpublished Rewrite' } });
    expect(screen.getByText(/Unsaved changes/)).toBeTruthy();
    expect((discard as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(discard);
    expect(screen.getByRole('heading', { name: 'Discard unsaved changes?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Discard Changes' }));

    await waitFor(() => expect(screen.getByDisplayValue('Saved Puzzle')).toBeTruthy());
    expect(screen.queryByText(/Unsaved changes/)).toBeNull();
    expect((discard as HTMLButtonElement).disabled).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('clears a never-saved puzzle back to a blank draft', async () => {
    const fetchMock = renderEditor();
    await screen.findByDisplayValue('Saved Puzzle');

    fireEvent.click(screen.getByRole('button', { name: 'New' }));
    const nameInput = screen.getByDisplayValue('New Puzzle');
    fireEvent.change(nameInput, { target: { value: 'Abandoned Draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Discard Unsaved Changes' }));

    expect(screen.getByText(/Clear the unsaved puzzle "Abandoned Draft"/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Discard Changes' }));

    await waitFor(() => expect(screen.getByDisplayValue('New Puzzle')).toBeTruthy());
    expect(screen.getByText('Discarded the unsaved puzzle draft.')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
