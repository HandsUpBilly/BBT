import { useMemo, useRef, useState } from 'react';
import type { Scenario, SeriesDefinition, Team } from '../types';
import { AVATAR_ALLOWED_TYPES, encodeAvatarFile, validateAvatarFile } from '../avatarImage';
import { seriesLogoSource } from '../seriesLogo';
import { TEAMS, teamLabel } from '../teamPresentation';
import { deleteSeries, saveSeries } from './editorApi';
import { seriesMembershipErrors } from '../../../shared/scenarioValidation.js';

interface Props {
  scenarios: Scenario[];
  series: SeriesDefinition[];
  idToken: string | null;
  onChange: (series: SeriesDefinition[]) => void;
  onStatus: (status: string) => void;
}

function newSeries(order: number): SeriesDefinition {
  return {
    id: '',
    name: 'New Series',
    label: 'Series',
    description: '',
    scenarioIds: [],
    published: false,
    adminEnabled: false,
    teams: ['human', 'orc'],
    objective: 'touchdown',
    order,
  };
}

export function SeriesCreator({ scenarios, series, idToken, onChange, onStatus }: Props) {
  const [selectedId, setSelectedId] = useState(series[0]?.id ?? '');
  const selected = series.find(item => item.id === selectedId);
  const [draft, setDraft] = useState<SeriesDefinition>(() => selected ?? newSeries(series.length));
  const [creating, setCreating] = useState(series.length === 0);
  const [saving, setSaving] = useState(false);
  const [stepToAdd, setStepToAdd] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);

  const stepOptions = useMemo(() => scenarios
    .filter(scenario => !draft.scenarioIds.includes(scenario.id))
    .map(scenario => ({
      scenario,
      owner: series.find(item => item.id !== draft.id && item.scenarioIds.includes(scenario.id)),
    })), [draft.id, draft.scenarioIds, scenarios, series]);
  const selectedStep = stepOptions.find(item => item.scenario.id === stepToAdd);
  const logoSource = seriesLogoSource(draft.logo);
  const validationErrors = useMemo(
    () => seriesMembershipErrors(draft, series, scenarios),
    [draft, scenarios, series],
  );

  function select(id: string) {
    const next = series.find(item => item.id === id);
    if (!next) return;
    setSelectedId(id);
    setDraft(structuredClone(next));
    setCreating(false);
  }

  function startNew() {
    setSelectedId('');
    setDraft(newSeries(series.length));
    setCreating(true);
  }

  async function persist() {
    if (!draft.id.trim() || !draft.name.trim()) {
      onStatus('Series id and title are required.');
      return;
    }
    if (validationErrors.length) {
      onStatus(validationErrors.join(' '));
      return;
    }
    setSaving(true);
    try {
      const saved = await saveSeries(draft, creating, idToken);
      const next = [...series.filter(item => item.id !== saved.id), saved]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
      onChange(next);
      setSelectedId(saved.id);
      setDraft(structuredClone(saved));
      setCreating(false);
      onStatus(`Saved ${saved.name}. ${saved.published !== false ? 'Enabled for everyone.' : saved.adminEnabled ? 'Enabled for admins only.' : 'Creator only.'}`);
    } catch (error) {
      onStatus(error instanceof Error ? error.message : 'Failed to save series.');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (creating) return startNew();
    setSaving(true);
    try {
      const next = await deleteSeries(draft.id, idToken);
      onChange(next);
      const first = next[0];
      setSelectedId(first?.id ?? '');
      setDraft(first ? structuredClone(first) : newSeries(0));
      setCreating(!first);
      onStatus(`Deleted ${draft.name}. It has been removed from the player list.`);
    } catch (error) {
      onStatus(error instanceof Error ? error.message : 'Failed to delete series.');
    } finally {
      setSaving(false);
    }
  }

  function updateTeam(index: 0 | 1, team: Team) {
    const teams: [Team, Team] = [...(draft.teams ?? ['human', 'orc'])];
    teams[index] = team;
    setDraft(current => ({ ...current, teams }));
  }

  function moveStep(index: number, offset: -1 | 1) {
    const target = index + offset;
    if (target < 0 || target >= draft.scenarioIds.length) return;
    const scenarioIds = [...draft.scenarioIds];
    [scenarioIds[index], scenarioIds[target]] = [scenarioIds[target], scenarioIds[index]];
    setDraft(current => ({ ...current, scenarioIds }));
  }

  function addStep() {
    if (!stepToAdd || selectedStep?.owner || draft.scenarioIds.includes(stepToAdd)) return;
    setDraft(current => ({ ...current, scenarioIds: [...current.scenarioIds, stepToAdd] }));
    setStepToAdd('');
  }

  async function uploadLogo(file: File | undefined) {
    if (!file) return;
    const invalidReason = validateAvatarFile(file);
    if (invalidReason) {
      setLogoError(invalidReason);
      return;
    }
    setLogoBusy(true);
    setLogoError('');
    try {
      const logo = await encodeAvatarFile(file);
      setDraft(current => ({ ...current, logo }));
    } catch (error) {
      setLogoError(error instanceof Error ? error.message : 'Could not process that image.');
    } finally {
      setLogoBusy(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  }

  return (
    <section className="series-creator" aria-labelledby="series-creator-heading">
      <aside className="series-creator__library">
        <div className="editor__panel-heading">
          <div><span className="editor__eyebrow">Workflow</span><h2>Series Library</h2></div>
          <button className="btn btn--primary" type="button" onClick={startNew}>New Series</button>
        </div>
        {series.map(item => (
          <button key={item.id} type="button" className={`editor__puzzle-row${item.id === selectedId ? ' editor__puzzle-row--active' : ''}`} onClick={() => select(item.id)}>
            <strong>{item.name}</strong><span>{item.scenarioIds.length} steps · position {(item.order ?? 0) + 1} · {item.published !== false ? 'Everyone' : item.adminEnabled ? 'Admins' : 'Creator only'}</span>
          </button>
        ))}
      </aside>

      <div className="series-creator__form">
        <div className="editor__panel-heading"><div><span className="editor__eyebrow">Series Creator</span><h2 id="series-creator-heading">{creating ? 'Create Series' : 'Edit Series'}</h2><p>Series membership and play order are managed here. Each puzzle can belong to one series only.</p></div></div>
        <div className="series-creator__fields">
          <label>Series id<input value={draft.id} disabled={!creating} placeholder="rookie-cup" onChange={event => setDraft(current => ({ ...current, id: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))} /></label>
          <label>Title<input value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} /></label>
          <label>Series label<input value={draft.label ?? ''} placeholder="League" maxLength={40} onChange={event => setDraft(current => ({ ...current, label: event.target.value || undefined }))} /></label>
          <label className="series-creator__wide">Description<textarea value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} /></label>
          <label>First team<select value={(draft.teams ?? ['human', 'orc'])[0]} onChange={event => updateTeam(0, event.target.value as Team)}>{TEAMS.map(team => <option key={team} value={team} disabled={team === (draft.teams ?? ['human', 'orc'])[1]}>{teamLabel(team)}</option>)}</select></label>
          <label>Second team<select value={(draft.teams ?? ['human', 'orc'])[1]} onChange={event => updateTeam(1, event.target.value as Team)}>{TEAMS.map(team => <option key={team} value={team} disabled={team === (draft.teams ?? ['human', 'orc'])[0]}>{teamLabel(team)}</option>)}</select></label>
          <label>Objective<select value={draft.objective ?? 'touchdown'} onChange={() => undefined}><option value="touchdown">Touchdown</option></select></label>
          <label>List position<input type="number" min="1" value={(draft.order ?? 0) + 1} onChange={event => setDraft(current => ({ ...current, order: Math.max(0, Number(event.target.value) - 1) }))} /></label>
          <div className="series-creator__logo">
            <span>Series logo</span>
            <div className="series-creator__logo-control">
              {logoSource ? <img src={logoSource} alt="Series logo preview" /> : <span className="series-creator__logo-placeholder">No logo</span>}
              <div className="series-creator__logo-actions">
                <input
                  ref={logoInputRef}
                  hidden
                  type="file"
                  aria-label="Choose series logo file"
                  accept={AVATAR_ALLOWED_TYPES.join(',')}
                  onChange={event => { void uploadLogo(event.target.files?.[0]); }}
                />
                <button className="btn btn--secondary" type="button" disabled={logoBusy} onClick={() => logoInputRef.current?.click()}>{logoBusy ? 'Processing…' : 'Upload logo'}</button>
                {draft.logo ? <button className="btn btn--ghost" type="button" onClick={() => setDraft(current => ({ ...current, logo: undefined }))}>Remove</button> : null}
              </div>
            </div>
            {logoError ? <small className="editor__error" role="alert">{logoError}</small> : <small>PNG, JPEG or WebP; cropped square automatically.</small>}
          </div>
          <fieldset className="editor__toggle-group series-creator__wide">
            <legend>Availability</legend>
            <label className="editor__toggle">
              <input type="checkbox" aria-label="Enabled for everyone" checked={draft.published !== false} onChange={event => setDraft(current => ({ ...current, published: event.target.checked }))} />
              <span className="editor__toggle-track" aria-hidden="true" />
              <span aria-hidden="true">Everyone</span>
            </label>
            <label className="editor__toggle">
              <input type="checkbox" aria-label="Enabled for admins" checked={draft.adminEnabled === true} onChange={event => setDraft(current => ({ ...current, adminEnabled: event.target.checked }))} />
              <span className="editor__toggle-track" aria-hidden="true" />
              <span aria-hidden="true">Admins</span>
            </label>
          </fieldset>
        </div>

        <section className="series-creator__steps" aria-labelledby="series-steps-heading">
          <div className="editor__panel-heading"><div><span className="editor__eyebrow">Play order</span><h3 id="series-steps-heading">Steps</h3></div></div>
          <div className="series-creator__add-step">
            <select aria-label="Puzzle to add" value={stepToAdd} onChange={event => setStepToAdd(event.target.value)}>
              <option value="">Choose a puzzle…</option>
              {stepOptions.map(({ scenario, owner }) => (
                <option key={scenario.id} value={scenario.id} disabled={Boolean(owner)}>
                  {scenario.name}{owner ? ` — already in ${owner.name}` : ''}
                </option>
              ))}
            </select>
            <button className="btn btn--secondary" type="button" disabled={!stepToAdd || Boolean(selectedStep?.owner)} onClick={addStep}>Add Step</button>
          </div>
          <ol className="editor__series-list">
            {draft.scenarioIds.map((id, index) => {
              const scenario = scenarios.find(item => item.id === id);
              return <li key={id}><span><strong>{index + 1}. {scenario?.name ?? id}</strong><small>{id}</small></span><span className="editor__series-actions"><button type="button" disabled={index === 0} onClick={() => moveStep(index, -1)}>↑</button><button type="button" disabled={index === draft.scenarioIds.length - 1} onClick={() => moveStep(index, 1)}>↓</button><button type="button" onClick={() => setDraft(current => ({ ...current, scenarioIds: current.scenarioIds.filter(item => item !== id) }))}>Remove</button></span></li>;
            })}
          </ol>
          {validationErrors.length > 0 ? (
            <ul className="editor__errors" aria-label="Series validation errors">
              {validationErrors.map(error => <li key={error}>{error}</li>)}
            </ul>
          ) : null}
        </section>
        <div className="series-creator__footer"><button className="btn btn--primary" disabled={saving || validationErrors.length > 0} onClick={() => { void persist(); }}>Save Series</button><button className="btn btn--ghost" disabled={saving} onClick={() => { void remove(); }}>Delete Series</button></div>
      </div>
    </section>
  );
}
