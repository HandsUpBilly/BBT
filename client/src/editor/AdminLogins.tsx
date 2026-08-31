import { useCallback, useEffect, useState } from 'react';
import type { LoginEntry } from '../../../shared/loginTracking.js';
import { fetchPlayerLogins } from './editorApi';

interface Props { idToken: string | null }

type SortKey = 'name' | 'first' | 'last' | 'count';
type SortDirection = 'ascending' | 'descending';

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
}

function sortValue(entry: LoginEntry, key: SortKey): number | string {
  switch (key) {
    case 'name': return entry.name;
    case 'first': return Date.parse(entry.firstLoginAt);
    case 'last': return Date.parse(entry.lastLoginAt);
    case 'count': return entry.loginCount;
  }
}

function escapeCsv(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadLoginsCsv(entries: LoginEntry[]): void {
  const header = ['Handle', 'Signed in', 'First login', 'Last login', 'Login count'];
  const rows = entries.map(entry => [
    entry.name, entry.userId ? 'Yes' : 'No', entry.firstLoginAt, entry.lastLoginAt, entry.loginCount,
  ]);
  const csv = [header, ...rows].map(row => row.map(escapeCsv).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'turn-16-player-logins.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export function AdminLogins({ idToken }: Props) {
  const [entries, setEntries] = useState<LoginEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('last');
  const [sortDirection, setSortDirection] = useState<SortDirection>('descending');

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setEntries(await fetchPlayerLogins(idToken));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load player logins.');
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const toggleSort = (nextKey: SortKey) => {
    if (nextKey === sortKey) {
      setSortDirection(direction => direction === 'ascending' ? 'descending' : 'ascending');
    } else {
      setSortKey(nextKey);
      setSortDirection(nextKey === 'name' ? 'ascending' : 'descending');
    }
  };

  const filtered = entries
    ?.filter(entry => entry.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((left, right) => {
      const leftValue = sortValue(left, sortKey);
      const rightValue = sortValue(right, sortKey);
      if (sortKey === 'name') {
        return sortDirection === 'ascending'
          ? String(leftValue).localeCompare(String(rightValue))
          : String(rightValue).localeCompare(String(leftValue));
      }
      return sortDirection === 'ascending'
        ? Number(leftValue) - Number(rightValue)
        : Number(rightValue) - Number(leftValue);
    }) ?? [];

  return (
    <section className="admin-statistics__panel" aria-labelledby="player-logins-title">
      <div className="admin-statistics__panel-heading">
        <div>
          <h2 id="player-logins-title">Player Logins</h2>
          <p>Every handle that has logged in, unlike the anonymous figures above.</p>
        </div>
        <button className="btn btn--secondary" disabled={loading} onClick={() => { void load(); }}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="admin-statistics__error" role="alert">
          <p>{error}</p>
          <button className="btn btn--secondary" onClick={() => { void load(); }}>Try Again</button>
        </div>
      )}

      {loading && !entries && <p className="admin-statistics__status" role="status">Loading player logins...</p>}

      {entries && (
        <>
          <div className="admin-statistics__tools">
            <label>
              <span>Find player</span>
              <input
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Handle"
              />
            </label>
            <span>{filtered.length} of {entries.length} players</span>
            <button className="btn btn--secondary" onClick={() => downloadLoginsCsv(entries)}>
              Download CSV
            </button>
          </div>
          <div className="admin-statistics__table-wrap">
            <table className="admin-statistics__table">
              <thead>
                <tr>
                  {([
                    ['name', 'Handle'], ['first', 'First Login'], ['last', 'Last Login'], ['count', 'Logins'],
                  ] as const).map(([key, label]) => (
                    <th key={key} scope="col" aria-sort={sortKey === key ? sortDirection : 'none'}>
                      <button className="admin-statistics__sort" onClick={() => toggleSort(key)}>
                        {label}{sortKey === key ? (sortDirection === 'ascending' ? ' ↑' : ' ↓') : ''}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(entry => (
                  <tr key={entry.userId ?? entry.name}>
                    <th scope="row">
                      <strong>{entry.name}</strong>
                      <span>{entry.userId ? 'Signed in' : 'Guest'}</span>
                    </th>
                    <td>{formatDate(entry.firstLoginAt)}</td>
                    <td>{formatDate(entry.lastLoginAt)}</td>
                    <td>{entry.loginCount}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={4} className="admin-statistics__empty">No players match that search.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
