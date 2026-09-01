import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Scenario, SeriesDefinition } from '../types';
import { PuzzleEditor } from './PuzzleEditor';

const savedScenario: Scenario = {
  id: 'scenario-001',
  name: 'Saved Puzzle',
  description: 'The saved description.',
  activeTeam: 'human',
  objective: 'touchdown',
  freePlay: false,
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderEditor(scenarios: Scenario[] = [savedScenario], series?: SeriesDefinition[]) {
  const initialData = {
    scenarios,
    series: series ?? [{
      id: 'default',
      name: 'Tutorial',
      description: '',
      scenarioIds: scenarios.filter(scenario => scenario.published !== false).map(scenario => scenario.id),
      teams: ['human', 'orc'],
      objective: 'touchdown',
      order: 0,
    }],
  };
  const fetchMock = vi.fn().mockImplementation((_: unknown, options?: RequestInit) => Promise.resolve({
    ok: true,
    json: async () => options?.method === 'PUT' ? JSON.parse(String(options.body)) : initialData,
  }));
  vi.stubGlobal('fetch', fetchMock);
  render(
    <PuzzleEditor
      onBack={vi.fn()}
      onPlay={vi.fn()}
      onReport={vi.fn()}
      previewScenario={null}
      idToken="admin-token"
    />,
  );
  return fetchMock;
}

function openCreatorTool(name: RegExp) {
  fireEvent.click(screen.getByRole('tab', { name }));
}

describe('PuzzleEditor unsaved changes', { timeout: 15_000 }, () => {
  it('adds and removes applicable implemented career skills while keeping future skills unavailable', async () => {
    renderEditor();
    await screen.findByDisplayValue('Saved Puzzle');
    fireEvent.click(screen.getByRole('button', { name: /Column 7, row 7:/ }));

    const block = screen.getByRole('button', { name: 'Block' });
    const fend = screen.getByRole('button', { name: 'Fend' });
    expect((fend as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(block);
    expect(block.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(block);
    expect(block.getAttribute('aria-pressed')).toBe('false');
  });

  it('shows BB2025 roster usage and blocks excess positional players', async () => {
    const threeBlitzers: Scenario = {
      ...savedScenario,
      pieces: [0, 1, 2].map(index => ({
        ...savedScenario.pieces[0],
        id: `human-blitzer-${index}`,
        role: 'blitzer',
        position: { col: 5 + index, row: 7 },
        hasBall: index === 0,
      })),
    };
    renderEditor([threeBlitzers]);
    await screen.findByDisplayValue('Saved Puzzle');

    const blitzer = screen.getByRole('button', { name: /Human Blitzer/ }) as HTMLButtonElement;
    expect(blitzer.disabled).toBe(true);
    expect(screen.getByText(/3\/2 · MA 7/)).toBeTruthy();
    openCreatorTool(/^Review/);
    expect(screen.getByText('Human roster allows at most 2 Human Blitzers (currently 3)')).toBeTruthy();
  });

  it('can discard edits and restore the last saved draft without an API write', async () => {
    const fetchMock = renderEditor();

    const nameInput = await screen.findByDisplayValue('Saved Puzzle');
    openCreatorTool(/^Review/);
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
    openCreatorTool(/^Review/);
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

  it('opens the player inspector when a placed player is selected', async () => {
    renderEditor();
    const playerSquare = await screen.findByRole('button', { name: /Column 7, row 7: Aldric/ });

    fireEvent.click(playerSquare);

    expect(screen.getByRole('tab', { name: /^Player$/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByDisplayValue('Aldric')).toBeTruthy();
  });

  it('keeps puzzle metadata here while series membership belongs to the Series Creator', async () => {
    const fetchMock = renderEditor();
    await screen.findByDisplayValue('Saved Puzzle');

    expect((screen.getByRole('combobox', { name: 'Objective' }) as HTMLSelectElement).value).toBe('touchdown');
    expect(screen.queryByRole('combobox', { name: 'Series' })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enabled for everyone' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enabled for admins' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Also enabled for Free Play' }));

    fireEvent.click(screen.getByRole('button', { name: 'Save Puzzle' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/editor/scenarios/scenario-001', expect.objectContaining({ method: 'PUT' })));
    const scenarioCall = fetchMock.mock.calls.find(([url]) => url === '/api/editor/scenarios/scenario-001');
    expect(JSON.parse(String(scenarioCall?.[1]?.body))).toMatchObject({
      objective: 'touchdown', freePlay: true, published: false, adminEnabled: true,
    });
  });

  it('shows puzzles owned by another series but does not let them be added again', async () => {
    const secondScenario = { ...savedScenario, id: 'scenario-002', name: 'Already Owned' };
    renderEditor([savedScenario, secondScenario], [
      { id: 'default', name: 'Tutorial', description: '', scenarioIds: ['scenario-001'], published: true, teams: ['human', 'orc'], objective: 'touchdown', order: 0 },
      { id: 'advanced', name: 'Advanced', description: '', scenarioIds: ['scenario-002'], published: true, teams: ['human', 'orc'], objective: 'touchdown', order: 1 },
    ]);
    await screen.findByDisplayValue('Saved Puzzle');
    openCreatorTool(/^Series Creator$/);

    expect(screen.getByText(/Series membership and play order are managed here/)).toBeTruthy();
    const ownedOption = screen.getByRole('option', { name: 'Already Owned — already in Advanced' }) as HTMLOptionElement;
    expect(ownedOption.disabled).toBe(true);
  });

  it('prevents a series save while an assigned puzzle has an illegal roster', async () => {
    const twoTrolls: Scenario = {
      ...savedScenario,
      id: 'two-trolls',
      name: 'Two Troll Trouble',
      pieces: [0, 1].map(index => ({
        ...savedScenario.pieces[0],
        id: `orc-troll-${index}`,
        team: 'orc',
        role: 'troll',
        position: { col: 6 + index, row: 7 },
        hasBall: index === 0,
      })),
      activeTeam: 'orc',
    };
    renderEditor([twoTrolls], [
      { id: 'league', name: 'League', description: '', scenarioIds: ['two-trolls'], published: true, teams: ['human', 'orc'], objective: 'touchdown', order: 0 },
    ]);
    await screen.findByDisplayValue('Two Troll Trouble');
    openCreatorTool(/^Series Creator$/);

    expect(screen.getByText('Two Troll Trouble: Orc roster allows at most 1 Troll (currently 2)')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save Series' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('saves title, description, and an uploaded chooser logo in the distinct Series Creator', async () => {
    const fetchMock = renderEditor();
    await screen.findByDisplayValue('Saved Puzzle');
    openCreatorTool(/^Series Creator$/);

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Orc Academy' } });
    fireEvent.change(screen.getByLabelText('Series label'), { target: { value: 'League' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'A new six-drill course.' } });
    const uploadedLogo = 'data:image/webp;base64,YWJj';
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 300, height: 200, close: vi.fn() }));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(uploadedLogo);
    fireEvent.change(screen.getByLabelText('Choose series logo file'), {
      target: { files: [new File(['image'], 'logo.png', { type: 'image/png' })] },
    });
    await screen.findByRole('img', { name: 'Series logo preview' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enabled for everyone' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enabled for admins' }));

    fireEvent.click(screen.getByRole('button', { name: 'Save Series' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/editor/series/default', expect.objectContaining({ method: 'PUT' })));
    const [, options] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, RequestInit];
    expect(JSON.parse(String(options.body))).toMatchObject({
      name: 'Orc Academy',
      label: 'League',
      description: 'A new six-drill course.',
      logo: uploadedLogo,
      published: false,
      adminEnabled: true,
    });
    expect(screen.queryByRole('button', { name: /Publish Drafts/i })).toBeNull();
  });
});
