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

function renderEditor(scenarios: Scenario[] = [savedScenario]) {
  const initialData = {
    scenarios,
    series: {
      id: 'default',
      name: 'Tutorial',
      description: '',
      scenarioIds: scenarios.filter(scenario => scenario.published !== false).map(scenario => scenario.id),
    },
  };
  const fetchMock = vi.fn().mockImplementation((_url, options?: RequestInit) => Promise.resolve({
    ok: true,
    json: async () => options?.method === 'PUT' ? JSON.parse(String(options.body)) : initialData,
  }));
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

describe('PuzzleEditor unsaved changes', { timeout: 15_000 }, () => {
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

  it('finds puzzles by name and filters the list by publishing state', async () => {
    const disabledScenario: Scenario = {
      ...savedScenario,
      id: 'scenario-002',
      name: 'Disabled Puzzle',
      published: false,
    };
    renderEditor([savedScenario, disabledScenario]);
    await screen.findByDisplayValue('Saved Puzzle');

    fireEvent.change(screen.getByRole('searchbox', { name: 'Find puzzle' }), { target: { value: 'disabled' } });
    expect(screen.getByText('Disabled Puzzle')).toBeTruthy();
    expect(screen.queryByText('Saved Puzzle')).toBeNull();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Find puzzle' }), { target: { value: '' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter puzzles' }), { target: { value: 'enabled' } });
    expect(screen.getByText('Saved Puzzle')).toBeTruthy();
    expect(screen.queryByText('Disabled Puzzle')).toBeNull();
  });

  it('saves title, description, and chooser logo as guarded series details', async () => {
    const fetchMock = renderEditor();
    await screen.findByDisplayValue('Saved Puzzle');

    fireEvent.change(screen.getByLabelText('Series name'), { target: { value: 'Orc Academy' } });
    fireEvent.change(screen.getByLabelText('Series description'), { target: { value: 'A new six-drill course.' } });
    fireEvent.change(screen.getByLabelText('Chooser logo key'), { target: { value: 'orc-academy' } });

    expect((screen.getByRole('button', { name: 'Publish Drafts' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Save Series Details' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/editor/series/default', expect.objectContaining({ method: 'PUT' })));
    const [, options] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, RequestInit];
    expect(JSON.parse(String(options.body))).toMatchObject({
      name: 'Orc Academy',
      description: 'A new six-drill course.',
      logo: 'orc-academy',
    });
  });
});
