import { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from '../ConfirmDialog';
import { PlayerAvatar } from '../PlayerAvatar';
import { playerAvatarUrl } from '../playerProfile';
import {
  addAdmin,
  fetchAdminAccess,
  fetchModeratedPlayerProfiles,
  fetchRankingResetSummary,
  removeAdmin,
  removeModeratedAvatar,
  resetRankings,
} from './editorApi';
import type {
  ModeratedPlayerProfile,
  RankingResetSummary,
  RankingResetTarget,
} from './editorApi';
import './AdminConsole.css';

interface Props { idToken: string | null; onBack: () => void; }

interface PendingRankingReset {
  target: RankingResetTarget;
  label: string;
  count: number;
}

export function AdminConsole({ idToken, onBack }: Props) {
  const [access, setAccess] = useState<{
    managedAdmins: string[];
    configuredAdminCount: number;
    audit: Array<{ action: 'added' | 'removed'; actor: string; target: string; at: string }>;
  } | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ModeratedPlayerProfile[]>([]);
  const [pendingAvatarRemoval, setPendingAvatarRemoval] = useState<string | null>(null);
  const [rankings, setRankings] = useState<RankingResetSummary | null>(null);
  const [pendingRankingReset, setPendingRankingReset] = useState<PendingRankingReset | null>(null);
  const [rankingNotice, setRankingNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [nextAccess, nextProfiles, nextRankings] = await Promise.all([
        fetchAdminAccess(idToken),
        fetchModeratedPlayerProfiles(idToken),
        fetchRankingResetSummary(idToken),
      ]);
      setAccess(nextAccess);
      setProfiles(nextProfiles);
      setRankings(nextRankings);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load the admin console.');
    }
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

  async function removeAvatar(userId: string) {
    setBusy(true); setError(null);
    try {
      const updated = await removeModeratedAvatar(userId, idToken);
      setProfiles(current => current.map(profile => profile.userId === userId ? updated : profile));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not remove public avatar.');
    } finally {
      setBusy(false); setPendingAvatarRemoval(null);
    }
  }

  async function clearRankings(pending: PendingRankingReset) {
    setBusy(true);
    setError(null);
    setRankingNotice(null);
    try {
      const result = await resetRankings(pending.target, idToken);
      setRankings(result.summary);
      setRankingNotice(
        `${result.removed} ranking ${result.removed === 1 ? 'entry' : 'entries'} cleared from ${pending.label}. Public screens can take up to 15 seconds to refresh.`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not clear rankings.');
    } finally {
      setBusy(false);
      setPendingRankingReset(null);
    }
  }

  return <section className="admin-console">
    <header className="editor__header">
      <div>
        <h1 className="editor__title">Admin Console</h1>
        <p className="editor__subtitle">Control administrators, public profiles, and ranking data.</p>
      </div>
      <div className="editor__header-actions">
        <button className="btn btn--secondary" onClick={onBack}>Back</button>
        <button className="btn btn--primary" onClick={() => { void load(); }}>Refresh</button>
      </div>
    </header>
    <div className="admin-console__notice">Managed administrators take effect immediately. The permanent owner and deployment administrators configured through <code>ADMIN_EMAILS</code> remain outside this list.</div>
    {error && <div className="admin-console__error" role="alert">{error}</div>}

    <section className="admin-console__panel admin-console__panel--rankings">
      <div className="admin-console__panel-heading">
        <div>
          <h2>Ranking data</h2>
          <p>Clear retained personal-best rankings without changing profiles, login history, analytics, or local attempt history.</p>
        </div>
        <button
          className="btn btn--danger"
          disabled={busy || !rankings?.totalEntries}
          onClick={() => rankings && setPendingRankingReset({
            target: { scope: 'all' },
            label: 'every ranking board',
            count: rankings.totalEntries,
          })}
        >
          Clear all rankings
        </button>
      </div>
      {rankingNotice && <p className="admin-console__success" role="status">{rankingNotice}</p>}
      {rankings ? <>
        <p className="admin-console__count">{rankings.totalEntries} retained ranking {rankings.totalEntries === 1 ? 'entry' : 'entries'} in total</p>
        <div className="admin-console__ranking-groups">
          <div>
            <h3>Series</h3>
            <ul>{rankings.series.map(board => <li key={board.id}>
              <span><strong>{board.name}</strong><small>{board.count} {board.count === 1 ? 'entry' : 'entries'}</small></span>
              <button
                className="btn btn--danger"
                aria-label={`Clear ${board.name} series rankings`}
                disabled={busy || board.count === 0}
                onClick={() => setPendingRankingReset({
                  target: { scope: 'series', id: board.id },
                  label: `${board.name} series`,
                  count: board.count,
                })}
              >Clear</button>
            </li>)}</ul>
          </div>
          <div>
            <h3>Individual puzzles</h3>
            <ul>{rankings.puzzles.map(board => <li key={board.id}>
              <span><strong>{board.name}</strong><small>{board.count} {board.count === 1 ? 'entry' : 'entries'}</small></span>
              <button
                className="btn btn--danger"
                aria-label={`Clear ${board.name} puzzle rankings`}
                disabled={busy || board.count === 0}
                onClick={() => setPendingRankingReset({
                  target: { scope: 'puzzle', id: board.id },
                  label: `${board.name} puzzle`,
                  count: board.count,
                })}
              >Clear</button>
            </li>)}</ul>
          </div>
        </div>
      </> : <p>Loading ranking data…</p>}
    </section>

    <section className="admin-console__panel"><h2>Managed administrators</h2><p>Add or remove verified Google email addresses. The permanent owner always retains access.</p>
      <form onSubmit={event => { event.preventDefault(); void add(); }}><label>Email address<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="coach@example.com" required /></label><button className="btn btn--primary" disabled={busy}>Add administrator</button></form>
      {access ? <><p className="admin-console__count">{access.managedAdmins.length} managed · {access.configuredAdminCount} fixed</p><ul>{access.managedAdmins.map(address => <li key={address}><span>{address}</span><button className="btn btn--danger" disabled={busy} onClick={() => setPendingRemoval(address)}>Remove</button></li>)}</ul>{access.managedAdmins.length === 0 && <p>No managed administrators yet.</p>}</> : <p>Loading access controls…</p>}
    </section>

    <section className="admin-console__panel"><h2>Public profile moderation</h2><p>Uploaded and Google avatars are public. Remove an image immediately if it is unsuitable; country or nationality text remains visible.</p>
      {profiles.length > 0 ? <ul>{profiles.map(profile => <li key={profile.userId}>
        <span className="admin-console__profile">
          <PlayerAvatar
            name={profile.userId}
            src={profile.avatarVersion ? playerAvatarUrl(profile.userId, profile.avatarVersion) : undefined}
            className="admin-console__profile-avatar"
            fallbackClassName="admin-console__profile-avatar--fallback"
          />
          <span><strong>{profile.country || 'No country / nationality'}</strong><small>{profile.userId}</small></span>
        </span>
        <button className="btn btn--danger" disabled={busy || !profile.hasAvatar} onClick={() => setPendingAvatarRemoval(profile.userId)}>Remove avatar</button>
      </li>)}</ul> : <p>No public player profiles yet.</p>}
    </section>

    {access && <section className="admin-console__panel"><h2>Access history</h2><p>Latest 100 managed-access changes.</p><ul>{access.audit.map(entry => <li key={`${entry.at}-${entry.action}-${entry.target}`}><span>{entry.actor} {entry.action} {entry.target}</span><time dateTime={entry.at}>{new Date(entry.at).toLocaleString()}</time></li>)}</ul>{access.audit.length === 0 && <p>No managed access changes recorded yet.</p>}</section>}
    {pendingRemoval && <ConfirmDialog title="Remove administrator?" message={`${pendingRemoval} will lose console access immediately.`} confirmLabel="Remove" destructive onCancel={() => setPendingRemoval(null)} onConfirm={() => { void remove(pendingRemoval); }} />}
    {pendingAvatarRemoval && <ConfirmDialog title="Remove public avatar?" message="The player will fall back to initials on every public ranking. They can choose a new avatar later." confirmLabel="Remove avatar" destructive onCancel={() => setPendingAvatarRemoval(null)} onConfirm={() => { void removeAvatar(pendingAvatarRemoval); }} />}
    {pendingRankingReset && <ConfirmDialog
      title={pendingRankingReset.target.scope === 'all' ? 'Clear every ranking?' : `Clear ${pendingRankingReset.label} rankings?`}
      message={`This permanently removes ${pendingRankingReset.count} retained ${pendingRankingReset.count === 1 ? 'entry' : 'entries'} from ${pendingRankingReset.label}. Player profiles, login history, analytics, and local attempt history are not changed.`}
      confirmLabel={pendingRankingReset.target.scope === 'all'
        ? 'Clear all rankings'
        : pendingRankingReset.target.scope === 'series' ? 'Clear series rankings' : 'Clear puzzle rankings'}
      destructive
      onCancel={() => setPendingRankingReset(null)}
      onConfirm={() => { void clearRankings(pendingRankingReset); }}
    />}
  </section>;
}
