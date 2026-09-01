import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import type { Scenario, ScenarioPieceDef, SeriesDefinition, Team } from '../types';
import { ConfirmDialog } from '../ConfirmDialog';
import { AdminStatistics } from './AdminStatistics';
import { AdminConsole } from './AdminConsole';
import { createScenario, deleteScenario, fetchEditorData, updateScenario } from './editorApi';
import { nextScenarioId, validateScenarioDraft } from './editorValidation';
import { PLAYER_TEMPLATES, generatedPlayerName, templateToPiece } from './playerTemplates';
import { careerSkillGroupsFor, IMPLEMENTED_CAREER_SKILLS } from './careerSkills';
import { playerPortraitFor } from '../playerPortraits';
import { SeriesCreator } from './SeriesCreator';
import { STAT_KEYS, STAT_RANGE, PITCH, rosterLimitFor } from '../../../shared/scenarioValidation.js';
import './PuzzleEditor.css';

const COLS = PITCH.maxCol + 1;
const ROWS = PITCH.maxRow + 1;
type InspectorSection = 'roster' | 'player' | 'review';

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
    objective: 'touchdown',
    freePlay: false,
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

function rosterRoles(team: Team): string[] {
  return groupTemplates(team).map(template => template.role);
}

function rosterUsage(scenario: Scenario, team: Team, role: string) {
  const limit = rosterLimitFor(team, role);
  const teamCount = scenario.pieces.filter(piece => piece.team === team).length;
  const roleCount = limit
    ? scenario.pieces.filter(piece => piece.team === team && rosterLimitFor(team, piece.role)?.label === limit.label).length
    : 0;
  return { limit, teamCount, roleCount, allowed: teamCount < 11 && Boolean(limit) && roleCount < (limit?.max ?? 0) };
}

/** Structural comparison used to detect unsaved edits. */
function sameScenario(a: Scenario, b: Scenario): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

interface Props {
  onBack: () => void;
  onPlay: (scenario: Scenario) => void;
  onReport: () => void;
  previewScenario: Scenario | null;
  idToken: string | null;
}

export function PuzzleEditor({ onBack, onPlay, onReport, previewScenario, idToken }: Props) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [series, setSeries] = useState<SeriesDefinition[]>([]);
  const [draft, setDraft] = useState<Scenario>(() => emptyScenario([]));
  // The last-saved shape of the current draft, so we can tell whether the
  // editor holds unsaved work before discarding it.
  const [savedDraft, setSavedDraft] = useState<Scenario | null>(null);
  const [originalId, setOriginalId] = useState<string | undefined>();
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [ballTool, setBallTool] = useState(false);
  const [status, setStatus] = useState('Loading editor data...');
  const [saving, setSaving] = useState(false);
  const [puzzleQuery, setPuzzleQuery] = useState('');
  const [puzzleFilter, setPuzzleFilter] = useState<'all' | 'enabled' | 'disabled' | 'series'>('all');
  const [inspectorSection, setInspectorSection] = useState<InspectorSection>('roster');
  // Pending confirmation, if any: the action to run once the player confirms.
  const [confirm, setConfirm] = useState<{
    title: string; message: string; confirmLabel: string; destructive?: boolean; run: () => void;
  } | null>(null);
  const [adminSection, setAdminSection] = useState<'editor' | 'series' | 'statistics' | 'console'>('editor');

  const load = useCallback(async () => {
    try {
      const data = await fetchEditorData(idToken);
      setScenarios(data.scenarios);
      setSeries(Array.isArray(data.series) ? data.series : [data.series]);
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
  const hasUnsavedChanges = savedDraft === null
    ? draft.pieces.length > 0 || draft.name !== 'New Puzzle'
    : !sameScenario(draft, savedDraft);
  const hasUnsavedEditorChanges = hasUnsavedChanges;
  const filteredScenarios = useMemo(() => {
    const query = puzzleQuery.trim().toLocaleLowerCase();
    return scenarios.filter(scenario => {
      const matchesQuery = !query || `${scenario.id} ${scenario.name} ${scenario.description}`.toLocaleLowerCase().includes(query);
      const matchesFilter = puzzleFilter === 'all'
        || (puzzleFilter === 'enabled' && (scenario.published !== false || scenario.adminEnabled === true))
        || (puzzleFilter === 'disabled' && scenario.published === false && scenario.adminEnabled !== true)
        || (puzzleFilter === 'series' && series.some(item => item.scenarioIds.includes(scenario.id)));
      return matchesQuery && matchesFilter;
    });
  }, [puzzleFilter, puzzleQuery, scenarios, series]);

  // Warn on tab close/reload while edits are pending. Re-registering the
  // listener when the flag flips keeps it out of a ref written during render.
  useEffect(() => {
    if (!hasUnsavedEditorChanges) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedEditorChanges]);

  const selectedPiece = selectedPieceId
    ? draft.pieces.find(piece => piece.id === selectedPieceId)
    : undefined;
  const selectedPieceCareerSkills = selectedPiece
    ? careerSkillGroupsFor(selectedPiece.team, selectedPiece.role)
    : null;

  function discardUnsavedWork() {
    if (hasUnsavedChanges) {
      const restored = savedDraft ? cloneScenario(savedDraft) : emptyScenario(existingIds);
      setDraft(restored);
      setOriginalId(savedDraft?.id);
      setSelectedPieceId(null);
      setBallTool(false);
    }
  }

  /** Runs `action`, first asking to confirm if the editor has unsaved edits. */
  function guardUnsaved(action: () => void, what: string) {
    if (!hasUnsavedEditorChanges) {
      action();
      return;
    }
    setConfirm({
      title: 'Discard unsaved changes?',
      message: `${what} will lose your unsaved puzzle changes.`,
      confirmLabel: 'Discard',
      destructive: true,
      run: () => { discardUnsavedWork(); action(); },
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

  function requestDiscardUnsavedChanges() {
    if (!hasUnsavedEditorChanges) return;
    const discardingNewPuzzle = hasUnsavedChanges && savedDraft === null;
    setConfirm({
      title: 'Discard unsaved changes?',
      message: savedDraft
          ? `Restore "${savedDraft.name}" to its last saved draft?`
          : `Clear the unsaved puzzle "${draft.name}" and start with a blank draft?`,
      confirmLabel: 'Discard Changes',
      destructive: true,
      run: () => {
        discardUnsavedWork();
        setStatus(discardingNewPuzzle ? 'Discarded the unsaved puzzle draft.' : 'Discarded unsaved editor changes.');
      },
    });
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

  function toggleCareerSkill(piece: ScenarioPieceDef, skill: string) {
    const skills = piece.skills.includes(skill)
      ? piece.skills.filter(existing => existing !== skill)
      : [...piece.skills, skill];
    updatePiece(piece.id, { skills });
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
    if (piece) setInspectorSection('player');
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
    const usage = rosterUsage(draft, template.team, template.role);
    if (!usage.allowed) {
      setStatus(usage.teamCount >= 11
        ? `${template.team === 'human' ? 'Human' : 'Orc'} team already has 11 players on the pitch.`
        : `${usage.limit?.label ?? template.label} limit reached (${usage.limit?.max ?? 0}).`);
      return;
    }
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
      setStatus(`Saved ${saved.id}. ${saved.published !== false ? 'Enabled for everyone.' : saved.adminEnabled ? 'Enabled for admins only.' : 'Creator only.'}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to save puzzle.');
    } finally {
      setSaving(false);
    }
  }

  function requestDelete() {
    if (!originalId) {
      setStatus('Unsaved drafts can be cleared with New or Reload.');
      return;
    }
    setConfirm({
      title: `Delete ${draft.name}?`,
      message: 'This removes the puzzle from the library and from its current series immediately.',
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
      setSeries(Array.isArray(data.series) ? data.series : [data.series]);
      const nextDraft = data.scenarios[0] ?? emptyScenario([]);
      const isSaved = data.scenarios.some(scenario => scenario.id === nextDraft.id);
      setDraft(cloneScenario(nextDraft));
      setSavedDraft(isSaved ? cloneScenario(nextDraft) : null);
      setOriginalId(isSaved ? nextDraft.id : undefined);
      setSelectedPieceId(null);
      setBallTool(false);
      setStatus(`Deleted ${originalId}. The player list is updated.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to delete puzzle.');
    } finally {
      setSaving(false);
    }
  }

  function openStatistics() {
    guardUnsaved(() => {
      setAdminSection('statistics');
    }, 'Opening statistics');
  }

  return (
    <div className="editor">
      <nav className="editor__sections" role="tablist" aria-label="Puzzle Creator sections">
        <button
          className={`editor__section-tab${adminSection === 'editor' ? ' editor__section-tab--active' : ''}`}
          type="button"
          role="tab"
          aria-selected={adminSection === 'editor'}
          onClick={() => setAdminSection('editor')}
        >
          Puzzle Creator
        </button>
        <button
          className={`editor__section-tab${adminSection === 'series' ? ' editor__section-tab--active' : ''}`}
          type="button"
          role="tab"
          aria-selected={adminSection === 'series'}
          onClick={() => guardUnsaved(() => setAdminSection('series'), 'Opening the Series Creator')}
        >
          Series Creator
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
        <button
          className={`editor__section-tab${adminSection === 'console' ? ' editor__section-tab--active' : ''}`}
          type="button"
          role="tab"
          aria-selected={adminSection === 'console'}
          onClick={() => guardUnsaved(() => setAdminSection('console'), 'Opening the admin console')}
        >
          Admin Console
        </button>
      </nav>

      {adminSection === 'console' ? (
        <AdminConsole idToken={idToken} onBack={onBack} onReport={onReport} />
      ) : adminSection === 'statistics' ? (
        <AdminStatistics idToken={idToken} onBack={onBack} />
      ) : adminSection === 'series' ? (
        <>
          <header className="editor__header">
            <div className="editor__heading"><span className="editor__kicker">Campaign workshop</span><h1 className="editor__title">Series Creator</h1><p className="editor__subtitle">Create a series, set its identity and list position, then arrange its puzzle steps.</p></div>
            <div className="editor__header-actions"><button className="btn btn--secondary" onClick={onBack}>Back</button></div>
          </header>
          <SeriesCreator scenarios={scenarios} series={series} idToken={idToken} onChange={setSeries} onStatus={setStatus} />
          <div className="editor__status" role="status">{status}</div>
        </>
      ) : (
        <>
      <header className="editor__header">
        <div className="editor__heading">
          <span className="editor__kicker">Scenario workshop</span>
          <h1 className="editor__title">Puzzle Creator</h1>
          <p className="editor__subtitle">
            Build one-turn puzzles, test every route, then save enabled puzzles for players.
          </p>
        </div>
        <div className="editor__draft-state" aria-live="polite">
          <span className={`editor__draft-marker${hasUnsavedEditorChanges || !originalId ? ' editor__draft-marker--changed' : ''}`} aria-hidden="true" />
          <span>
            <strong>{hasUnsavedEditorChanges ? 'Unsaved changes' : originalId ? 'Saved' : 'New puzzle'}</strong>
            <small>{validationErrors.length === 0 ? 'Ready to test' : `${validationErrors.length} issue${validationErrors.length === 1 ? '' : 's'} to resolve`}</small>
          </span>
        </div>
        <div className="editor__header-actions">
          <button className="btn btn--secondary" onClick={() => guardUnsaved(onBack, 'Leaving the editor')}>Back</button>
          <button className="btn btn--secondary" onClick={() => onPlay(draft)} disabled={validationErrors.length > 0}>
            Play Draft
          </button>
          <button
            className="btn btn--primary"
            disabled={saving || validationErrors.length > 0}
            onClick={() => { void saveScenario(Boolean(originalId)); }}
          >
            {saving ? 'Saving...' : 'Save Puzzle'}
          </button>
        </div>
      </header>

      <div className="editor__status-strip" role="status">
        <span>{draft.id}</span>
        <p>{status}</p>
      </div>

      <div className="editor__layout">
        <aside className="editor__panel editor__panel--list" aria-label="Puzzle library">
          <div className="editor__panel-header">
            <div>
              <span className="editor__panel-number">01</span>
              <h2>Puzzle Library</h2>
            </div>
            <button className="btn btn--secondary" onClick={createNew}>New</button>
          </div>
          <div className="editor__puzzle-tools">
            <input
              type="search"
              value={puzzleQuery}
              onChange={event => setPuzzleQuery(event.target.value)}
              placeholder="Find by name or ID"
              aria-label="Find puzzle"
            />
            <select value={puzzleFilter} onChange={event => setPuzzleFilter(event.target.value as typeof puzzleFilter)} aria-label="Filter puzzles">
              <option value="all">All puzzles</option>
              <option value="enabled">Any enabled</option>
              <option value="disabled">Creator only</option>
              <option value="series">In series</option>
            </select>
            <span>{filteredScenarios.length} of {scenarios.length}</span>
          </div>
          <div className="editor__puzzle-list">
            {filteredScenarios.map(scenario => {
              const membership = series.find(item => item.scenarioIds.includes(scenario.id));
              const position = membership?.scenarioIds.indexOf(scenario.id) ?? -1;
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
                    {scenario.published !== false ? 'Everyone' : scenario.adminEnabled ? 'Admins' : 'Creator only'}
                  </span>
                  <span className={position >= 0 ? 'editor__puzzle-series' : 'editor__puzzle-series editor__puzzle-series--out'}>
                    {position >= 0 ? `${membership?.name} · step ${position + 1}` : 'Not in series'}
                  </span>
                </button>
              );
            })}
            {filteredScenarios.length === 0 && <p className="editor__empty-list">No puzzles match that filter.</p>}
          </div>
          <button className="btn btn--secondary editor__duplicate" onClick={duplicateCurrent}>Duplicate Current</button>
        </aside>

        <main className="editor__pitch-panel">
          <header className="editor__stage-header">
            <div>
              <span className="editor__panel-number">02</span>
              <h2>Board Setup</h2>
            </div>
            <p><strong>{draft.pieces.length}</strong> players placed</p>
          </header>
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
            <label>
              Objective
              <select value={draft.objective ?? 'touchdown'} onChange={() => undefined}>
                <option value="touchdown">Touchdown</option>
              </select>
            </label>
            <fieldset className="editor__toggle-group">
              <legend>Availability</legend>
              <label className="editor__toggle">
                <input
                  type="checkbox"
                  aria-label="Enabled for everyone"
                  checked={draft.published !== false}
                  onChange={event => setMetadata('published', event.target.checked)}
                />
                <span className="editor__toggle-track" aria-hidden="true" />
                <span aria-hidden="true">Everyone</span>
              </label>
              <label className="editor__toggle">
                <input
                  type="checkbox"
                  aria-label="Enabled for admins"
                  checked={draft.adminEnabled === true}
                  onChange={event => setMetadata('adminEnabled', event.target.checked)}
                />
                <span className="editor__toggle-track" aria-hidden="true" />
                <span aria-hidden="true">Admins</span>
              </label>
              <label className="editor__toggle">
                <input
                  type="checkbox"
                  aria-label="Also enabled for Free Play"
                  checked={draft.freePlay === true}
                  onChange={event => setMetadata('freePlay', event.target.checked)}
                />
                <span className="editor__toggle-track" aria-hidden="true" />
                <span aria-hidden="true">Free Play</span>
              </label>
            </fieldset>
            <label className="editor__metadata-desc">
              Description
              <textarea value={draft.description} onChange={event => setMetadata('description', event.target.value)} />
            </label>
          </section>

          <div className="editor__pitch-frame">
            <span className="editor__endzone-label">Orc end zone</span>
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
            <span className="editor__endzone-label editor__endzone-label--bottom">Human end zone</span>
          </div>
        </main>

        <aside className="editor__panel editor__panel--inspector" aria-label="Creator tools">
          <header className="editor__inspector-header">
            <span className="editor__panel-number">03</span>
            <h2>Creator Tools</h2>
          </header>
          <nav className="editor__inspector-tabs" role="tablist" aria-label="Creator tools">
            {([
              ['roster', 'Roster'],
              ['player', 'Player'],
              ['review', validationErrors.length > 0 ? `Review ${validationErrors.length}` : 'Review'],
            ] as [InspectorSection, string][]).map(([section, label]) => (
              <button
                key={section}
                type="button"
                role="tab"
                aria-selected={inspectorSection === section}
                className={`editor__inspector-tab${inspectorSection === section ? ' editor__inspector-tab--active' : ''}`}
                onClick={() => setInspectorSection(section)}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="editor__inspector-body">
          {inspectorSection === 'roster' && (
          <section className="editor-tool" aria-labelledby="roster-heading">
            <h2 id="roster-heading">Player Roster</h2>
            {(['human', 'orc'] as Team[]).map(team => (
              <div key={team} className="editor-tool__group">
                <h3>{team === 'human' ? 'Humans' : 'Orcs'}</h3>
                {groupTemplates(team).map(template => {
                  const usage = rosterUsage(draft, template.team, template.role);
                  return (
                  <button
                    key={template.key}
                    className={`palette-piece palette-piece--${template.team}`}
                    draggable={usage.allowed}
                    disabled={!usage.allowed}
                    title={!usage.allowed ? 'BB2025 roster limit reached' : undefined}
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
                      <span>{usage.roleCount}/{usage.limit?.max ?? '—'} · MA {template.ma} ST {template.st} AG {template.ag} PA {template.pa} AV {template.av}</span>
                    </span>
                  </button>
                  );
                })}
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
          )}

          {inspectorSection === 'player' && (
          <section className="editor-tool" aria-labelledby="player-heading">
            <h2 id="player-heading">Selected Player</h2>
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
                      const roles = rosterRoles(team);
                      const role = roles.includes(selectedPiece.role ?? '')
                        ? selectedPiece.role
                        : roles[0];
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
                    value={selectedPiece.role ?? rosterRoles(selectedPiece.team)[0]}
                    onChange={event => updatePiece(selectedPiece.id, { role: event.target.value })}
                  >
                    {rosterRoles(selectedPiece.team).map(role => (
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
                <div className="editor__career-skills" aria-labelledby="career-skills-heading">
                  <div>
                    <h3 id="career-skills-heading">Career skills</h3>
                    <p className="editor__hint">Select an applicable skill to add or remove it. Bright skills have game rules; grey skills are legal BB2025 choices not modelled yet.</p>
                  </div>
                  {selectedPieceCareerSkills ? (
                    <div className="editor__career-skill-groups">
                      {(['primary', 'secondary'] as const).map(tier => {
                        const groups = selectedPieceCareerSkills.filter(group => group.tier === tier);
                        if (groups.length === 0) return null;
                        return (
                          <section key={tier} className="editor__career-skill-tier" aria-label={`${tier} skill access`}>
                            <h4>{tier === 'primary' ? 'Primary access' : 'Secondary access'}</h4>
                            {groups.map(group => (
                              <div key={group.id} className="editor__career-skill-group">
                                <span>{group.label}</span>
                                <div className="editor__career-skill-list">
                                  {group.skills.map(skill => {
                                    const implemented = IMPLEMENTED_CAREER_SKILLS.has(skill);
                                    const selected = selectedPiece.skills.includes(skill);
                                    return (
                                      <button
                                        key={skill}
                                        type="button"
                                        className={`editor__career-skill ${selected ? 'editor__career-skill--selected' : ''} ${implemented ? '' : 'editor__career-skill--unimplemented'}`}
                                        disabled={!implemented}
                                        aria-pressed={selected}
                                        title={implemented ? `${selected ? 'Remove' : 'Add'} ${skill}` : `${skill} is not implemented in the rules engine yet`}
                                        onClick={() => toggleCareerSkill(selectedPiece, skill)}
                                      >
                                        {skill}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </section>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="editor__hint">Career skill access is unavailable for this custom or legacy role. Choose a current roster role to edit career skills.</p>
                  )}
                </div>
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
          )}

          {inspectorSection === 'review' && (
          <section className="editor-tool" aria-labelledby="review-heading">
            <h2 id="review-heading">Review Draft</h2>
            {validationErrors.length > 0 && (
              <ul className="editor__errors">
                {validationErrors.map(error => <li key={error}>{error}</li>)}
              </ul>
            )}
            <button className="btn btn--secondary" disabled={saving || validationErrors.length > 0} onClick={() => { void saveScenario(false); }}>
              Save As New
            </button>
            <button
              className="btn btn--secondary"
              disabled={saving || !hasUnsavedEditorChanges}
              onClick={requestDiscardUnsavedChanges}
            >
              Discard Unsaved Changes
            </button>
            <button className="btn btn--ghost" disabled={saving || !originalId} onClick={requestDelete}>
              Delete Puzzle
            </button>
            <button className="btn btn--secondary" onClick={() => guardUnsaved(() => { void load(); }, 'Reloading')}>Reload</button>
          </section>
          )}
          </div>
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
