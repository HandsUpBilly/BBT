import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import type { Scenario, ScenarioPieceDef, SeriesDefinition, Team } from '../types';
import { createScenario, fetchEditorData, updateDefaultSeries, updateScenario } from './editorApi';
import { nextScenarioId, validateScenarioDraft } from './editorValidation';
import { PLAYER_TEMPLATES, generatedPlayerName, templateToPiece } from './playerTemplates';
import './PuzzleEditor.css';

const COLS = 15;
const ROWS = 26;
const EMPTY_SERIES: SeriesDefinition = {
  id: 'default',
  name: 'Humans vs Orcs: Touchdown or Bust',
  description: '',
  scenarioIds: [],
};

function cloneScenario(scenario: Scenario): Scenario {
  return JSON.parse(JSON.stringify(scenario)) as Scenario;
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

interface Props {
  onBack: () => void;
  onPlay: (scenario: Scenario) => void;
  previewScenario: Scenario | null;
}

export function PuzzleEditor({ onBack, onPlay, previewScenario }: Props) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [series, setSeries] = useState<SeriesDefinition>(EMPTY_SERIES);
  const [draft, setDraft] = useState<Scenario>(() => emptyScenario([]));
  const [originalId, setOriginalId] = useState<string | undefined>();
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [ballTool, setBallTool] = useState(false);
  const [status, setStatus] = useState('Loading editor data...');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchEditorData();
      setScenarios(data.scenarios);
      setSeries(data.series);
      const first = previewScenario ?? data.scenarios[0] ?? emptyScenario([]);
      setDraft(cloneScenario(first));
      setOriginalId(data.scenarios.some(scenario => scenario.id === first.id) ? first.id : undefined);
      setSelectedPieceId(null);
      setStatus('Loaded editor data.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to load editor data.');
    }
  }, [previewScenario]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const existingIds = useMemo(() => scenarios.map(scenario => scenario.id), [scenarios]);
  const validationErrors = useMemo(
    () => validateScenarioDraft(draft, existingIds, originalId),
    [draft, existingIds, originalId],
  );
  const selectedPiece = selectedPieceId
    ? draft.pieces.find(piece => piece.id === selectedPieceId)
    : undefined;
  const seriesIndex = series.scenarioIds.indexOf(draft.id);
  const inSeries = seriesIndex >= 0;

  function updateDraft(updater: (scenario: Scenario) => Scenario) {
    setDraft(current => updater(cloneScenario(current)));
  }

  function selectScenario(scenario: Scenario) {
    setDraft(cloneScenario(scenario));
    setOriginalId(scenario.id);
    setSelectedPieceId(null);
    setBallTool(false);
    setStatus(`Editing ${scenario.id}.`);
  }

  function createNew() {
    const scenario = emptyScenario(existingIds);
    setDraft(scenario);
    setOriginalId(undefined);
    setSelectedPieceId(null);
    setBallTool(false);
    setStatus('Created an unsaved puzzle draft.');
  }

  function duplicateCurrent() {
    const nextId = nextScenarioId(existingIds);
    setDraft({
      ...cloneScenario(draft),
      id: nextId,
      name: `${draft.name} Copy`,
      published: false,
    });
    setOriginalId(undefined);
    setSelectedPieceId(null);
    setStatus(`Duplicated as ${nextId}.`);
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
        ? await updateScenario(draft)
        : await createScenario(draft);
      const next = scenarios.filter(scenario => scenario.id !== saved.id);
      const sorted = [...next, saved].sort((a, b) => a.id.localeCompare(b.id));
      setScenarios(sorted);
      setDraft(cloneScenario(saved));
      setOriginalId(saved.id);
      setStatus(`Saved ${saved.id}. Reload the dev server page if this is a new file.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to save puzzle.');
    } finally {
      setSaving(false);
    }
  }

  async function saveSeries(nextSeries: SeriesDefinition) {
    setSaving(true);
    try {
      const saved = await updateDefaultSeries(nextSeries);
      setSeries(saved);
      setStatus('Saved series assignment.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to save series.');
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

  return (
    <div className="editor">
      <header className="editor__header">
        <div>
          <h1 className="editor__title">Puzzle Editor</h1>
          <p className="editor__subtitle">Build local scenario JSON, publish puzzles, and manage the current series.</p>
        </div>
        <div className="editor__header-actions">
          <button className="btn btn--secondary" onClick={onBack}>Back</button>
          <button className="btn btn--primary" onClick={() => onPlay(draft)} disabled={validationErrors.length > 0}>
            Play Draft
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
            {scenarios.map(scenario => (
              <button
                key={scenario.id}
                className={`editor__puzzle-row${draft.id === scenario.id ? ' editor__puzzle-row--active' : ''}`}
                onClick={() => selectScenario(scenario)}
              >
                <strong>{scenario.name}</strong>
                <span>{scenario.id}</span>
                <span>{scenario.published === false ? 'Disabled' : 'Published'} · {scenario.pieces.length} players</span>
              </button>
            ))}
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
              Published
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
                return (
                  <button
                    key={`${col},${row}`}
                    className={[
                      'editor-pitch__square',
                      (col + row) % 2 === 0 ? 'editor-pitch__square--light' : 'editor-pitch__square--dark',
                      row === 0 ? 'editor-pitch__square--endzone-top' : '',
                      row === 25 ? 'editor-pitch__square--endzone-bottom' : '',
                      row === 13 ? 'editor-pitch__square--scrimmage' : '',
                      piece?.id === selectedPieceId ? 'editor-pitch__square--selected' : '',
                    ].filter(Boolean).join(' ')}
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
                    <strong>{template.label}</strong>
                    <span>MA {template.ma} ST {template.st} AG {template.ag} PA {template.pa} AV {template.av}</span>
                  </button>
                ))}
              </div>
            ))}
            <button
              className={`btn ${ballTool ? 'btn--primary' : 'btn--secondary'}`}
              onClick={() => setBallTool(active => !active)}
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
                  <input value={selectedPiece.id} onChange={event => {
                    const nextId = event.target.value;
                    updatePiece(selectedPiece.id, { id: nextId });
                    setSelectedPieceId(nextId);
                  }} />
                </label>
                <label className="editor__checkbox">
                  <input type="checkbox" checked={selectedPiece.hasBall} onChange={() => assignBallToPiece(selectedPiece.id)} />
                  Has ball
                </label>
                <div className="editor__stats">
                  <span>MA {selectedPiece.ma}</span>
                  <span>ST {selectedPiece.st}</span>
                  <span>AG {selectedPiece.ag}</span>
                  <span>PA {selectedPiece.pa}</span>
                  <span>AV {selectedPiece.av}</span>
                </div>
                <div className="editor__skills">{selectedPiece.skills.length ? selectedPiece.skills.join(', ') : 'No skills'}</div>
                <button className="btn btn--ghost" onClick={deleteSelectedPiece}>Delete Player</button>
              </>
            ) : (
              <p className="editor__hint">Select a placed player to rename, assign the ball, or delete it.</p>
            )}
          </section>

          <section className="editor-tool">
            <h2>Series</h2>
            <p className="editor__hint">{series.name}</p>
            <button className="btn btn--secondary" onClick={toggleSeriesAssignment}>
              {inSeries ? 'Remove From Series' : 'Add To Series'}
            </button>
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
            <button className="btn btn--secondary" onClick={() => { void load(); }}>Reload</button>
            <p className="editor__status">{status}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
