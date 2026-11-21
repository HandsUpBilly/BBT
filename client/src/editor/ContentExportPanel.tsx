import { useEffect, useState } from 'react';
import { ConfirmDialog } from '../ConfirmDialog';
import {
  openContentSyncPullRequest, previewContentSync,
} from './editorApi';
import type { ContentExportItem, ContentExportPreview } from './editorApi';

interface Props {
  idToken: string | null;
  onClose: () => void;
  onStatus: (message: string) => void;
}

/** Preview is always refreshed from the server. No item is preselected. */
export function ContentExportPanel({ idToken, onClose, onStatus }: Props) {
  const [preview, setPreview] = useState<ContentExportPreview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    setSelected([]);
    try {
      const current = await previewContentSync(idToken);
      setPreview(current);
    } catch (reason) {
      setPreview(null);
      setError(reason instanceof Error ? reason.message : 'Could not preview GitHub changes.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Defer to avoid the StrictMode double-invocation overwriting results.
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  // The editor panel is remounted to refresh; token changes invalidate the view.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idToken]);

  function toggle(item: ContentExportItem) {
    if (!item.selectable) return;
    const key = `${item.kind}/${item.id}`;
    setSelected(current => current.includes(key)
      ? current.filter(value => value !== key) : [...current, key]);
  }

  const chosen = (preview?.items ?? []).filter(item =>
    item.selectable && selected.includes(`${item.kind}/${item.id}`));

  async function createPullRequest() {
    if (!preview || chosen.length === 0) return;
    setSubmitting(true);
    setConfirm(false);
    setError(null);
    try {
      const result = await openContentSyncPullRequest(idToken, preview, chosen);
      if (!result.pullRequest) throw new Error('GitHub did not return a pull request URL.');
      onStatus(`Created GitHub review for ${result.changes} selected item(s): ${result.pullRequest}`);
      window.open(result.pullRequest, '_blank', 'noopener,noreferrer');
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'GitHub export failed.');
      // Do not reuse a stale snapshot or silently include other content.
      setPreview(null);
      setSelected([]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="editor__status" aria-label="GitHub export preview">
      <h2>Review live changes for GitHub</h2>
      <p>Select exactly which puzzle or series files should enter a public GitHub pull request.
        Nothing is selected automatically. Unselected changes will stay in the live editor.</p>
      {loading ? <p role="status">Checking GitHub and live revisions...</p> : null}
      {error ? <p role="alert">{error} Refresh the preview before submitting.</p> : null}
      {preview && !loading ? (
        <>
          <p>Staging revision: <code>{preview.baseSha.slice(0, 12)}</code></p>
          {preview.items.length === 0 ? <p>No pending live changes.</p> : (
            <div role="group" aria-label="Files to include in GitHub pull request">
              {preview.items.map(item => {
                const key = `${item.kind}/${item.id}`;
                return (
                  <label key={key} style={{ display: 'block', marginBottom: '0.5rem' }}>
                    <input type="checkbox" checked={selected.includes(key)}
                      disabled={!item.selectable || submitting} onChange={() => toggle(item)} />
                    <code>{item.path}</code> ({item.action})
                    {item.conflictPaths.length ? (
                      <span> Conflict: {item.conflictPaths.join(', ')}</span>
                    ) : null}
                    {!item.selectable && !item.conflictPaths.length ? (
                      <span> No exportable difference</span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          )}
          <p>{chosen.length} file(s) selected for export. Other drafts remain untouched.</p>
        </>
      ) : null}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn--secondary" onClick={() => { void refresh(); }}
          disabled={loading || submitting}>Refresh preview</button>
        <button type="button" className="btn btn--primary"
          onClick={() => setConfirm(true)} disabled={loading || submitting || chosen.length === 0}>
          Review selected files in GitHub
        </button>
        <button type="button" className="btn btn--secondary" onClick={onClose}
          disabled={submitting}>Cancel</button>
      </div>
      {confirm ? <ConfirmDialog
        title={`Create a public GitHub PR with ${chosen.length} selected file(s)?`}
        message={`Only these files will be included: ${chosen.map(item => item.path).join(', ')}. Unpublished puzzle drafts will be visible to anyone who can read the repository's pull requests. Nothing is automatically merged or published to the game.`}
        confirmLabel="Create selected PR" cancelLabel="Cancel"
        onConfirm={() => { void createPullRequest(); }}
        onCancel={() => setConfirm(false)}
      /> : null}
    </section>
  );
}
