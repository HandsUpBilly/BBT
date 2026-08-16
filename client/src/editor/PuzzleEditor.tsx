import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import type { Scenario, ScenarioPieceDef, SeriesDefinition, Team } from '../types';
import { ConfirmDialog } from '../ConfirmDialog';
import { AdminStatistics } from './AdminStatistics';
import { createScenario, deleteScenario, fetchEditorData, publishEditorData, updateDefaultSeries, updateScenario } from './editorApi';
import { missingSeriesScenarioIds, nextScenarioId, validateScenarioDraft } from './editorValidation';
import { PLAYER_TEMPLATES, generatedPlayerName, templateToPiece } from './playerTemplates';
import { PLAYER_ROLES, playerPortraitFor } from '../playerPortraits';
import { STAT_KEYS, STAT_RANGE, PITCH } from '../../../shared/scenarioValidation.js';
import './PuzzleEditor.css';

const COLS = PITCH.maxCol + 1;
const ROWS = PITCH.maxRow + 1;
const EMPTY_SERIES: SeriesDefinition = {
  id: 'default',
  name: 'Humans vs Orcs: Touchdown or Bust',
  description: '',
  scenarioIds: [],
};

const STAT_LABELS: Record<string, string> = {
  ma: 'MA', st: 'ST', ag: 'AG', pa: 'PA', av: 'AV',
};

function cloneScenario(scenario: Scenario): Scenario {
  return structuredClone(scenario);
}

function emptyScenario(existingIds: string[]): Scenario {
  return {
    id: nextScenarioId(existingIds),
    name: 'New Puzzle',
    description: 'Describe the scoring puzzle.',
    activeTeam: 'human',
    published: false,
    ballPosition: null,
    pieces: [],
  };
}

function pieceAt(scenario: Scenario, col: number, row: number): ScenarioPieceDef | undefined {
  return scenario.pieces.find(piece => piece.position.col === col && piece.position.row === row);
}

function makePieceId(scenario: Scenario, team: Team, role: string): string {
  const prefix = `${team}-${role}`.replace(/[^a-z0-9-]/g, '-');
  let index = scenario.pieces.length + 1;
  let id = `${prefix}-${index}`;
  const ids = new Set(scenario.pieces.map(piece => piece.id));
  while (ids.has(id)) {
    index += 1;
    id = `${prefix}-${index}`;
  }
  return id;
}

function groupTemplates(team: Team) {
  return PLAYER_TEMPLATES.filter(template => template.team === team);
}

/** Structural comparison used to detect unsaved edits. */
function sameScenario(a: Scenario, b: Scenario): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

interface Props {
  onBack: () => void;
  onPlay: (scenario: Scenario) => void;
  previewScenario: Scenario | null;
  idToken: string | null;
}

export function PuzzleEditor({ onBack, onPlay, previewScenario, idToken }: Props) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [series, setSeries] = useState<SeriesDefinition>(EMPTY_SERIES);
  const [draft, setDraft] = useState<Scenario>(() => emptyScenario([]));
  // The last-saved shape of the current draft, so we can tell whether the
  // editor holds unsaved work before discarding it.
  const [savedDraft, setSavedDraft] = useState<Scenario | null>(null);
  const [originalId, setOriginalId] = useState<string | undefined>();
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [ballTool, setBallTool] = useState(false);
  const [status, setStatus] = useState('Loading editor data...');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  // Pending confirmation, if any: the action to run once the player confirms.
  const [confirm, setConfirm] = useState<{
    title: string; message: string; confirmLabel: string; destructive?: boolean; run: () => void;
  } | null>(null);
  const [adminSection, setAdminSection] = useState<'editor' | 'statistics'>('editor');

  const load = useCallback(async () => {
    try {
      const data = await fetchEditorData(idToken);
      setScenarios(data.scenarios);
      setSeries(data.series);
      const first = previewScenario ?? data.scenarios[0] ?? emptyScenario([]);
      const clone = cloneScenario(first);
      setDraft(clone);
      setSavedDraft(data.scenarios.some(scenario => scenario.id === first.id) ? cloneScenario(first) : null);
      setOriginalId(data.scenarios.some(scenario => scenario.id === first.id) ? first.id : undefined);
      setSelectedPieceId(null);
      setStatus('Loaded editor data.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to load editor data.');
    }
  }, [previewScenario, idToken]);

  // Deferred to a macrotask so React 19 StrictMode's double-invoked effect
  // doesn't fire two concurrent loads on mount.
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const existingIds = useMemo(() => scenarios.map(scenario => scenario.id), [scenarios]);
  const validationErrors = useMemo(
    () => validateScenarioDraft(draft, existingIds, originalId),
    [draft, existingIds, originalId],
  );
  // Series entries pointing at scenarios that no longer exist would silently
  // shorten a series run, so surface them here rather than dropping them.
  const missingSeriesIds = useMemo(
    () => missingSeriesScenarioIds(series, scenarios),
    [series, scenarios],
  );
  const hasUnsavedChanges = savedDraft === null
    ? draft.pieces.length > 0 || draft.name !== 'New Puzzle'
    : !sameScenario(draft, savedDraft);

  // Warn on tab close/reload while edits are pending. Re-registering the
  // listener when the flag flips keeps it out of a ref written during render.
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedChanges]);

  const selectedPiece = selectedPieceId
    ? draft.pieces.find(piece => piece.id === selectedPieceId)
    : undefined;
  const seriesIndex = series.scenarioIds.indexOf(draft.id);
  const inSeries = seriesIndex >= 0;

  /** Runs `action`, first asking to confirm if the draft has unsaved edits. */
  function guardUnsaved(action: () => void, what: string) {
    if (!hasUnsavedChanges) {
      action();
      return;
    }
    setConfirm({
      title: 'Discard unsaved changes?',
      message: `${what} will lose the edits you've made to "${draft.name}".`,
      confirmLabel: 'Discard',
      destructive: true,
      run: action,
    });
  }

  function updateDraft(updater: (scenario: Scenario) => Scenario) {
    setDraft(current => updater(cloneScenario(current)));
  }

  function selectScenario(scenario: Scenario) {
    guardUnsaved(() => {
      setDraft(cloneScenario(scenario));
      setSavedDraft(cloneScenario(scenario));
      setOriginalId(scenario.id);
      setSelectedPieceId(null);
      setBallTool(false);
      setStatus(`Editing ${scenario.id}.`);
    }, 'Opening another puzzle');
  }

  function createNew() {
    guardUnsaved(() => {
      const scenario = emptyScenario(existingIds);
      setDraft(scenario);
      setSavedDraft(null);
      setOriginalId(undefined);
      setSelectedPieceId(null);
      setBallTool(false);
      setStatus('Created an unsaved puzzle draft.');
    }, 'Starting a new puzzle');
  }

  function duplicateCurrent() {
    const nextId = nextScenarioId(existingIds);
    setDraft({
      ...cloneScenario(draft),
      id: nextId,
      name: `${draft.name} Copy`,
      published: false,
    });
    setSavedDraft(null);
    setOriginalId(undefined);
    setSelectedPieceId(null);
    setStatus(`Duplicated as ${nextId}. Save As New to keep it.`);
  }

  function setMetadata<K extends keyof Scenario>(keyName: K, value: Scenario[K]) {
    updateDraft(scenario => ({ ...scenario, [keyName]: value }));
  }

  function updatePiece(pieceId: string, patch: Partial<ScenarioPieceDef>) {
    updateDraft(scenario => ({
      ...scenario,
      pieces: scenario.pieces.map(piece => piece.id === pieceId ? { ...piece, ...patch } : piece),
    }));
  }

  /**
   * Piece ids are rewritten on blur rather than per keystroke — editing them
   * live meant every intermediate value (including the empty string) briefly
   * became the piece's real id, and could collide with another piece.
   */
  function commitPieceId(pieceId: string, rawNextId: string) {
    const nextId = rawNextId.trim();
    if (!nextId || nextId === pieceId) return;
    if (draft.pieces.some(piece => piece.id === nextId)) {
      setStatus(`Player id "${nextId}" is already used.`);
      return;
    }
    updatePiece(pieceId, { id: nextId });
    setSelectedPieceId(nextId);
  }

  function deleteSelectedPiece() {
    if (!selectedPieceId) return;
    updateDraft(scenario => ({
      ...scenario,
      pieces: scenario.pieces.filter(piece => piece.id !== selectedPieceId),
    }));
    setSelectedPieceId(null);
  }

  function assignBallToPiece(pieceId: string) {
    updateDraft(scenario => ({
      ...scenario,
      ballPosition: null,
      pieces: scenario.pieces.map(piece => ({ ...piece, hasBall: piece.id === pieceId })),
    }));
  }

  function placeLooseBall(col: number, row: number) {
    updateDraft(scenario => ({
      ...scenario,
      ballPosition: { col, row },
      pieces: scenario.pieces.map(piece => ({ ...piece, hasBall: false })),
    }));
  }

  function movePiece(pieceId: string, col: number, row: number) {
    updateDraft(scenario => {
      if (scenario.pieces.some(piece => piece.id !== pieceId && piece.position.col === col && piece.position.row === row)) {
        return scenario;
      }
      return {
        ...scenario,
        pieces: scenario.pieces.map(piece => (
          piece.id === pieceId ? { ...piece, position: { col, row } } : piece
        )),
      };
    });
  }

  function handleSquareClick(col: number, row: number) {
    const piece = pieceAt(draft, col, row);
    if (ballTool) {
      if (piece) assignBallToPiece(piece.id);
      else placeLooseBall(col, row);
      return;
    }
    setSelectedPieceId(piece?.id ?? null);
  }

  function handleDrop(col: number, row: number, event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (pieceAt(draft, col, row)) return;
    const pieceId = event.dataTransfer.getData('application/x-bbt-piece-id');
    const templateKey = event.dataTransfer.getData('application/x-bbt-template');
    if (pieceId) {
      movePiece(pieceId, col, row);
      return;
    }
    const template = PLAYER_TEMPLATES.find(item => item.key === templateKey);
    if (!template) return;
    updateDraft(scenario => {
      const id = makePieceId(scenario, template.team, template.role);
      const sameTeamCount = scenario.pieces.filter(piece => piece.team === template.team).length;
      return {
        ...scenario,
        pieces: [...scenario.pieces, templateToPiece(template, id, col, row, generatedPlayerName(template, sameTeamCount))],
      };
    });
  }

  async function saveScenario(overwrite: boolean) {
    const errors = validateScenarioDraft(draft, existingIds, overwrite ? originalId : undefined);
    if (errors.length) {
      setStatus(errors.join(' '));
      return;
    }
    setSaving(true);
    try {
      const saved = overwrite && originalId === draft.id
        ? await updateScenario(draft, idToken)
        : await createScenario(draft, idToken);
      const next = scenarios.filter(scenario => scenario.id !== saved.id);
      const sorted = [...next, saved].sort((a, b) => a.id.localeCompare(b.id));
      setScenarios(sorted);
      setDraft(cloneScenario(saved));
      setSavedDraft(cloneScenario(saved));
      setOriginalId(saved.id);
      setStatus(`Saved ${saved.id} as a draft. Click Publish Drafts to make it live for players.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to save puzzle.');
    } finally {
      setSaving(false);
    }
  }

  async function saveSeries(nextSeries: SeriesDefinition) {
    setSaving(true);
    try {
      const saved = await updateDefaultSeries(nextSeries, idToken);
      setSeries(saved);
      setStatus('Saved series assignment.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to save series.');
    } finally {
      setSaving(false);
    }
  }

  function requestPublish() {
    setConfirm({
      title: 'Publish drafts to players?',
      message: 'PUBLISH: Every saved change becomes live immediately. This includes new puzzles, edits, deletions, and enabled or disabled puzzles.',
      confirmLabel: 'Publish',
      run: () => { void publish(); },
    });
  }

  async function publish() {
    setPublishing(true);
    try {
      await publishEditorData(idToken);
      setStatus('Published. Live for players now.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to publish.');
    } finally {
      setPublishing(false);
    }
  }

  function requestDelete() {
    if (!originalId) {
      setStatus('Unsaved drafts can be cleared with New or Reload.');
      return;
    }
    setConfirm({
      title: `Delete ${draft.name}?`,
      message: 'This removes the puzzle from drafts and from the current series. Publish afterwards to apply it for players.',
      confirmLabel: 'Delete',
      destructive: true,
      run: () => { void deleteCurrentScenario(); },
    });
  }

  async function deleteCurrentScenario() {
    if (!originalId) return;
    setSaving(true);
    try {
      const data = await deleteScenario(originalId, idToken);
      setScenarios(data.scenarios);
      setSeries(data.series);
      const nextDraft = data.scenarios[0] ?? emptyScenario([]);
      const isSaved = data.scenarios.some(scenario => scenario.id === nextDraft.id);
      setDraft(cloneScenario(nextDraft));
      setSavedDraft(isSaved ? cloneScenario(nextDraft) : null);
      setOriginalId(isSaved ? nextDraft.id : undefined);
      setSelectedPieceId(null);
      setBallTool(false);
      setStatus(`Deleted ${originalId}. Click Publish Drafts to update players.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to delete puzzle.');
    } finally {
      setSaving(false);
    }
  }

  function toggleSeriesAssignment() {
    const scenarioIds = inSeries
      ? series.scenarioIds.filter(id => id !== draft.id)
      : [...series.scenarioIds, draft.id];
    void saveSeries({ ...series, scenarioIds });
  }

  function moveSeries(offset: -1 | 1) {
    if (!inSeries) return;
    const next = [...series.scenarioIds];
    const target = seriesIndex + offset;
    if (target < 0 || target >= next.length) return;
    [next[seriesIndex], next[target]] = [next[target], next[seriesIndex]];
    void saveSeries({ ...series, scenarioIds: next });
  }

  function removeMissingSeriesIds() {
    void saveSeries({
      ...series,
      scenarioIds: series.scenarioIds.filter(id => !missingSeriesIds.includes(id)),
    });
  }

  function openStatistics() {
    guardUnsaved(() => {
      if (hasUnsavedChanges) {
        const restored = savedDraft ? cloneScenario(savedDraft) : emptyScenario(existingIds);
        setDraft(restored);
        setOriginalId(savedDraft?.id);
        setSelectedPieceId(null);
        setBallTool(false);
      }
      setAdminSection('statistics');
    }, 'Opening statistics');
  }

  return (
    <div className="editor">
      <nav className="editor__sections" role="tablist" aria-label="Admin sections">
        <button
          className={`editor__section-tab${adminSection === 'editor' ? ' editor__section-tab--active' : ''}`}
          type="button"
          role="tab"
          aria-selected={adminSection === 'editor'}
          onClick={() => setAdminSection('editor')}
        >
          Puzzle Editor
        </button>
        <button
          className={`editor__section-tab${adminSection === 'statistics' ? ' editor__section-tab--active' : ''}`}
          type="button"
          role="tab"
          aria-selected={adminSection === 'statistics'}
          onClick={openStatistics}
        >
          Statistics
        </button>
      </nav>

      {adminSection === 'statistics' ? (
        <AdminStatistics idToken={idToken} onBack={onBack} />
      ) : (
        <>
      <header className="editor__header">
        <div>
          <h1 className="editor__title">Puzzle Editor</h1>
          <p className="editor__subtitle">
            Build scenario JSON and manage the current series. Saves stay as drafts until Publish Drafts makes them live for players.
          </p>
        </div>
        <div className="editor__header-actions">
          {hasUnsavedChanges && (
            <span className="editor__unsaved">Unsaved changes. Save before publishing.</span>
          )}
          <button className="btn btn--secondary" onClick={() => guardUnsaved(onBack, 'Leaving the editor')}>Back</button>
          <button className="btn btn--primary" onClick={() => onPlay(draft)} disabled={validationErrors.length > 0}>
            Play Draft
          </button>
          <button
            className="btn btn--primary"
            disabled={publishing || hasUnsavedChanges}
            title={hasUnsavedChanges ? 'Save changes before publishing. Only saved drafts can be published.' : undefined}
            onClick={requestPublish}
          >
            {publishing ? 'Publishing...' : 'Publish Drafts'}
          </button>
        </div>
      </header>

      <div className="editor__layout">
        <aside className="editor__panel editor__panel--list">
          <div className="editor__panel-header">
            <h2>Puzzles</h2>
            <button className="btn btn--secondary" onClick={createNew}>New</button>
          </div>
          <div className="editor__puzzle-list">
            {scenarios.map(scenario => {
              const position = series.scenarioIds.indexOf(scenario.id);
              return (
                <button
                  key={scenario.id}
                  className={`editor__puzzle-row${draft.id === scenario.id ? ' editor__puzzle-row--active' : ''}`}
                  onClick={() => selectScenario(scenario)}
                >
                  <strong>{scenario.name}</strong>
                  <span>{scenario.id}</span>
                  <span className="editor__puzzle-desc">{scenario.description}</span>
                  <span>
                    {scenario.activeTeam === 'orc' ? 'Orcs' : 'Humans'} active,{' '}
                    {scenario.pieces.length} player{scenario.pieces.length === 1 ? '' : 's'},{' '}
                    {scenario.published === false ? 'Disabled' : 'Enabled'}
                  </span>
                  <span className={position >= 0 ? 'editor__puzzle-series' : 'editor__puzzle-series editor__puzzle-series--out'}>
                    {position >= 0 ? `Series #${position + 1}` : 'Not in series'}
                  </span>
                </button>
              );
            })}
          </div>
          <button className="btn btn--secondary" onClick={duplicateCurrent}>Duplicate Current</button>
        </aside>

        <main className="editor__pitch-panel">
          <section className="editor__metadata">
            <label>
              ID
              <input value={draft.id} onChange={event => setMetadata('id', event.target.value)} disabled={Boolean(originalId)} />
            </label>
            <label>
              Name
              <input value={draft.name} onChange={event => setMetadata('name', event.target.value)} />
            </label>
            <label>
              Active team
              <select value={draft.activeTeam} onChange={event => setMetadata('activeTeam', event.target.value as Team)}>
                <option value="human">Human</option>
                <option value="orc">Orc</option>
              </select>
            </label>
            <label className="editor__checkbox">
              <input
                type="checkbox"
                checked={draft.published !== false}
                onChange={event => setMetadata('published', event.target.checked)}
              />
              Enabled for players
            </label>
            <label className="editor__metadata-desc">
              Description
              <textarea value={draft.description} onChange={event => setMetadata('description', event.target.value)} />
            </label>
          </section>

          <section className="editor-pitch" aria-label="Puzzle pitch">
            {Array.from({ length: ROWS }).map((_, row) => (
              Array.from({ length: COLS }).map((__, col) => {
                const piece = pieceAt(draft, col, row);
                const looseBall = draft.ballPosition?.col === col && draft.ballPosition.row === row;
                const squareLabel = `Column ${col}, row ${row}`;
                return (
                  <button
                    key={`${col},${row}`}
                    className={[
                      'editor-pitch__square',
                      (col + row) % 2 === 0 ? 'editor-pitch__square--light' : 'editor-pitch__square--dark',
                      row === 0 ? 'editor-pitch__square--endzone-top' : '',
                      row === ROWS - 1 ? 'editor-pitch__square--endzone-bottom' : '',
                      row === 13 ? 'editor-pitch__square--scrimmage' : '',
                      piece?.id === selectedPieceId ? 'editor-pitch__square--selected' : '',
                    ].filter(Boolean).join(' ')}
                    aria-label={piece
                      ? `${squareLabel}: ${piece.name}, ${piece.team} ${piece.role ?? ''}${piece.hasBall ? ', carrying the ball' : ''}`
                      : looseBall ? `${squareLabel}: loose ball` : `${squareLabel}: empty`}
                    onClick={() => handleSquareClick(col, row)}
                    onDragOver={event => event.preventDefault()}
                    onDrop={event => handleDrop(col, row, event)}
                    type="button"
                  >
                    {piece && (
                      <span
                        className={`editor-piece editor-piece--${piece.team}`}
                        draggable
                        onDragStart={event => event.dataTransfer.setData('application/x-bbt-piece-id', piece.id)}
                      >
                        {(piece.role ?? piece.team).slice(0, 2).toUpperCase()}
                        {piece.hasBall && <span className="editor-ball editor-ball--carried" />}
                      </span>
                    )}
                    {looseBall && <span className="editor-ball" />}
                  </button>
                );
              })
            ))}
          </section>
        </main>

        <aside className="editor__panel">
          <section className="editor-tool">
            <h2>Palette</h2>
            {(['human', 'orc'] as Team[]).map(team => (
              <div key={team} className="editor-tool__group">
                <h3>{team === 'human' ? 'Humans' : 'Orcs'}</h3>
                {groupTemplates(team).map(template => (
                  <button
                    key={template.key}
                    className={`palette-piece palette-piece--${template.team}`}
                    draggable
                    onDragStart={event => event.dataTransfer.setData('application/x-bbt-template', template.key)}
                    type="button"
                  >
                    <img
                      className="palette-piece__icon"
                      src={playerPortraitFor(template.team, template.role)}
                      alt=""
                      draggable={false}
                    />
                    <span className="palette-piece__text">
                      <strong>{template.label}</strong>
                      <span>MA {template.ma} ST {template.st} AG {template.ag} PA {template.pa} AV {template.av}</span>
                    </span>
                  </button>
                ))}
              </div>
            ))}
            <button
              className={`btn ${ballTool ? 'btn--primary' : 'btn--secondary'}`}
              onClick={() => setBallTool(active => !active)}
              aria-pressed={ballTool}
            >
              Ball Tool
            </button>
            <p className="editor__hint">With Ball Tool active, click a player to hand them the ball or an empty square to place it loose.</p>
          </section>

          <section className="editor-tool">
            <h2>Selected Player</h2>
            {selectedPiece ? (
              <>
                <label>
                  Name
                  <input value={selectedPiece.name} onChange={event => updatePiece(selectedPiece.id, { name: event.target.value })} />
                </label>
                <label>
                  ID
                  <input
                    // Uncontrolled-ish: keyed by piece id so switching selection
                    // resets it, but the draft is only touched on blur/Enter.
                    key={selectedPiece.id}
                    defaultValue={selectedPiece.id}
                    onBlur={event => commitPieceId(selectedPiece.id, event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter') event.currentTarget.blur();
                    }}
                  />
                </label>
                <label>
                  Team
                  <select
                    value={selectedPiece.team}
                    onChange={event => {
                      const team = event.target.value as Team;
                      // Keep the role valid for the new team.
                      const role = PLAYER_ROLES[team].includes(selectedPiece.role ?? '')
                        ? selectedPiece.role
                        : PLAYER_ROLES[team][0];
                      updatePiece(selectedPiece.id, { team, role });
                    }}
                  >
                    <option value="human">Human</option>
                    <option value="orc">Orc</option>
                  </select>
                </label>
                <label>
                  Role
                  <select
                    value={selectedPiece.role ?? PLAYER_ROLES[selectedPiece.team][0]}
                    onChange={event => updatePiece(selectedPiece.id, { role: event.target.value })}
                  >
                    {PLAYER_ROLES[selectedPiece.team].map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </label>
                <div className="editor__stat-inputs">
                  {STAT_KEYS.map(stat => (
                    <label key={stat} className="editor__stat-input">
                      {STAT_LABELS[stat]}
                      <input
                        type="number"
                        min={STAT_RANGE.min}
                        max={STAT_RANGE.max}
                        value={selectedPiece[stat]}
                        onChange={event => {
                          const value = Number(event.target.value);
                          if (!Number.isFinite(value)) return;
                          updatePiece(selectedPiece.id, { [stat]: value } as Partial<ScenarioPieceDef>);
                        }}
                      />
                    </label>
                  ))}
                </div>
                <label>
                  Skills
                  <input
                    value={selectedPiece.skills.join(', ')}
                    placeholder="Block, Dodge"
                    onChange={event => updatePiece(selectedPiece.id, {
                      skills: event.target.value.split(',').map(skill => skill.trim()).filter(Boolean),
                    })}
                  />
                </label>
                <p className="editor__hint">Comma-separated. Block, Wrestle, Dodge, and Tackle affect block resolution.</p>
                <label className="editor__checkbox">
                  <input type="checkbox" checked={selectedPiece.hasBall} onChange={() => assignBallToPiece(selectedPiece.id)} />
                  Has ball
                </label>
                <button className="btn btn--ghost" onClick={deleteSelectedPiece}>Delete Player</button>
              </>
            ) : (
              <p className="editor__hint">Select a placed player to edit its stats, skills, and role, assign the ball, or delete it. Drag a player to move it.</p>
            )}
          </section>

          <section className="editor-tool">
            <h2>Series</h2>
            <p className="editor__hint">{series.name}</p>
            {missingSeriesIds.length > 0 && (
              <div className="editor__errors" role="alert">
                <p>Series references missing puzzles: {missingSeriesIds.join(', ')}</p>
                <button className="btn btn--secondary" onClick={removeMissingSeriesIds}>
                  Remove Missing Entries
                </button>
              </div>
            )}
            <button className="btn btn--secondary" onClick={toggleSeriesAssignment} disabled={!originalId}>
              {inSeries ? 'Remove From Series' : 'Add To Series'}
            </button>
            {!originalId && <p className="editor__hint">Save the puzzle before adding it to the series.</p>}
            <div className="editor__series-actions">
              <button className="btn btn--secondary" disabled={!inSeries || seriesIndex === 0} onClick={() => moveSeries(-1)}>Move Up</button>
              <button className="btn btn--secondary" disabled={!inSeries || seriesIndex === series.scenarioIds.length - 1} onClick={() => moveSeries(1)}>Move Down</button>
            </div>
            <ol className="editor__series-list">
              {series.scenarioIds.map(id => (
                <li key={id} className={id === draft.id ? 'editor__series-item--active' : ''}>{id}</li>
              ))}
            </ol>
          </section>

          <section className="editor-tool">
            <h2>Save</h2>
            {validationErrors.length > 0 && (
              <ul className="editor__errors">
                {validationErrors.map(error => <li key={error}>{error}</li>)}
              </ul>
            )}
            <button className="btn btn--primary" disabled={saving || validationErrors.length > 0 || !originalId} onClick={() => { void saveScenario(true); }}>
              Save
            </button>
            <button className="btn btn--secondary" disabled={saving || validationErrors.length > 0} onClick={() => { void saveScenario(false); }}>
              Save As New
            </button>
            <button className="btn btn--ghost" disabled={saving || !originalId} onClick={requestDelete}>
              Delete Puzzle
            </button>
            <button className="btn btn--secondary" onClick={() => guardUnsaved(() => { void load(); }, 'Reloading')}>Reload</button>
            <p className="editor__status" role="status">{status}</p>
          </section>
        </aside>
      </div>
        </>
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          cancelLabel="Keep Editing"
          destructive={confirm.destructive}
          onConfirm={() => { const run = confirm.run; setConfirm(null); run(); }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
