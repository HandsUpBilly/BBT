import { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from '../ConfirmDialog';
import { addAdmin, fetchAdminAccess, removeAdmin } from './editorApi';
import './AdminConsole.css';

interface Props { idToken: string | null; onBack: () => void; }

export function AdminConsole({ idToken, onBack }: Props) {
  const [access, setAccess] = useState<{ managedAdmins: string[]; configuredAdminCount: number; audit: Array<{ action: 'added' | 'removed'; actor: string; target: string; at: string }> } | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try { setAccess(await fetchAdminAccess(idToken)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load administrator access.'); }
  }, [idToken]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function add() {
    setBusy(true); setError(null);
    try { setAccess(await addAdmin(email, idToken)); setEmail(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not add administrator.'); }
    finally { setBusy(false); }
  }
  async function remove(address: string) {
    setBusy(true); setError(null);
    try { setAccess(await removeAdmin(address, idToken)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not remove administrator.'); }
    finally { setBusy(false); setPendingRemoval(null); }
  }
  return <section className="admin-console">
    <header className="editor__header"><div><h1 className="editor__title">Admin Console</h1><p className="editor__subtitle">Control who can manage drafts, publishing, and player analytics.</p></div><div className="editor__header-actions"><button className="btn btn--secondary" onClick={onBack}>Back</button><button className="btn btn--primary" onClick={() => { void load(); }}>Refresh</button></div></header>
    <div className="admin-console__notice">Managed administrators take effect immediately. The permanent owner and deployment administrators configured through <code>ADMIN_EMAILS</code> remain outside this list.</div>
    {error && <div className="admin-console__error" role="alert">{error}</div>}
    <section className="admin-console__panel"><h2>Managed administrators</h2><p>Add or remove verified Google email addresses. The permanent owner always retains access.</p>
      <form onSubmit={event => { event.preventDefault(); void add(); }}><label>Email address<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="coach@example.com" required /></label><button className="btn btn--primary" disabled={busy}>Add administrator</button></form>
      {access ? <><p className="admin-console__count">{access.managedAdmins.length} managed · {access.configuredAdminCount} fixed</p><ul>{access.managedAdmins.map(address => <li key={address}><span>{address}</span><button className="btn btn--danger" disabled={busy} onClick={() => setPendingRemoval(address)}>Remove</button></li>)}</ul>{access.managedAdmins.length === 0 && <p>No managed administrators yet.</p>}</> : <p>Loading access controls…</p>}
    </section>
    {access && <section className="admin-console__panel"><h2>Access history</h2><p>Latest 100 managed-access changes.</p><ul>{access.audit.map(entry => <li key={`${entry.at}-${entry.action}-${entry.target}`}><span>{entry.actor} {entry.action} {entry.target}</span><time dateTime={entry.at}>{new Date(entry.at).toLocaleString()}</time></li>)}</ul>{access.audit.length === 0 && <p>No managed access changes recorded yet.</p>}</section>}
    {pendingRemoval && <ConfirmDialog title="Remove administrator?" message={`${pendingRemoval} will lose console access immediately.`} confirmLabel="Remove" destructive onCancel={() => setPendingRemoval(null)} onConfirm={() => { void remove(pendingRemoval); }} />}
  </section>;
}
