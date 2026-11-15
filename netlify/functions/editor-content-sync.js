import { editorStore, loadContent } from './editorStore.js';
import { contentVersions } from './contentStore.js';
import { planContentExport } from '../../shared/contentGitSync.js';
import { AdminAuthError, authErrorResponse, requireAdminGoogleUser } from './auth.js';

const REPO = 'HandsUpBilly/BBT';
const GITHUB_API = 'https://api.github.com';
const branch = 'staging';
const json = (status, data) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

async function github(path, token, options = {}) {
  const response = await fetch(`${GITHUB_API}/repos/${REPO}/${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (response.status === 404 && options.allowMissing) return null;
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`GitHub content sync failed (${response.status}): ${payload?.message ?? 'request rejected'}`);
  return payload;
}

function findItem(list, id) {
  return (list ?? []).find(item => item.id === id);
}

async function editorDiff(catalog, token, baseSha) {
  const versions = contentVersions(catalog);
  const changes = [];
  const conflicts = [];
  for (const kind of ['scenarios', 'series']) {
    for (const id of versions.dirty[kind]) {
      const base = findItem(catalog.baseline[kind], id);
      const live = findItem(catalog[kind], id);
      const path = `client/src/${kind}/${id}.json`;
      const gh = await github(`contents/${path}?ref=${encodeURIComponent(baseSha)}`, token, { allowMissing: true });
      let remote = null;
      if (gh) {
        const raw = await github(`git/blobs/${gh.sha}`, token);
        const bytes = Uint8Array.from(atob(raw.content.replace(/\s/g, '')), letter => letter.charCodeAt(0));
        remote = JSON.parse(new TextDecoder().decode(bytes));
      }
      // Treat an absent GitHub file as undefined, not as a deletion of
      // an item that an admin might just have created live.
      const result = planContentExport({ base, live, remote: remote ?? undefined, kind, id });
      if (result.conflicts.length) {
        conflicts.push({ kind, id, paths: result.conflicts });
        continue;
      }
      if (result.change) changes.push(result.change);
    }
  }
  return { changes, conflicts };
}

/**
 * Explicitly open a PR, never push directly to staging/main. The current
 * staging version is fetched per item and three-way merged before the PR
 * branch is created; overlapping edits fail closed and stay in live Blobs.
 */
export default async function handler(req) {
  if (!['GET', 'POST'].includes(req.method)) return json(405, { errors: ['Method not allowed'] });
  try { await requireAdminGoogleUser(req); } catch (error) {
    if (error instanceof AdminAuthError) return authErrorResponse(error);
    throw error;
  }
  const token = process.env.GITHUB_CONTENT_SYNC_TOKEN;
  const catalog = await loadContent(editorStore());
  const status = contentVersions(catalog);
  if (req.method === 'GET') return json(200, {
    configured: Boolean(token), ...status,
  });
  if (!token) return json(503, { errors: [
    'Configure GITHUB_CONTENT_SYNC_TOKEN (Contents and Pull requests: read/write) on the Netlify site.',
  ] });
  if (Object.values(status.conflicts).some(map => Object.values(map).some(paths => paths.length))) {
    return json(409, { errors: ['Resolve existing GitHub/editor conflicts before exporting.'], conflicts: status.conflicts });
  }
  try {
    // Pin the GitHub snapshot before inspecting any file so we cannot merge
    // changes read from different staging commits into one PR.
    const baseRef = await github(`git/ref/heads/${branch}`, token);
    const { changes, conflicts } = await editorDiff(catalog, token, baseRef.object.sha);
    if (conflicts.length) return json(409, {
      errors: ['GitHub changed since this editor content was last synchronised. Resolve these differences first.'],
      conflicts,
    });
    if (!changes.length) return json(200, { synced: true, changes: 0 });
    // Branch off the fresh staging commit so unrelated source changes survive.
    const baseCommit = await github(`git/commits/${baseRef.object.sha}`, token);
    const tree = await github('git/trees', token, {
      method: 'POST', body: JSON.stringify({
        base_tree: baseCommit.tree.sha,
        tree: changes.map(change => ({
          path: change.path, mode: '100644', type: 'blob',
          ...(change.value === undefined ? { sha: null } : { content: JSON.stringify(change.value, null, 2) + '\n' }),
        })),
      }),
    });
    const commit = await github('git/commits', token, {
      method: 'POST', body: JSON.stringify({
        message: `Sync ${changes.length} live editor item(s)`,
        tree: tree.sha, parents: [baseRef.object.sha],
      }),
    });
    const syncBranch = `editor-sync/${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    await github('git/refs', token, {
      method: 'POST', body: JSON.stringify({ ref: `refs/heads/${syncBranch}`, sha: commit.sha }),
    });
    const pr = await github('pulls', token, {
      method: 'POST', body: JSON.stringify({
        title: `Sync ${changes.length} live-edited Turn 16 content item(s)`,
        head: syncBranch, base: branch,
        body: 'Generated by the live Puzzle Editor. Review the changes and merge into staging. The live editor retains its content until the GitHub deployment catches up. No production or leaderboard changes were made by this request.',
      }),
    });
    return json(201, { synced: false, changes: changes.length, pullRequest: pr.html_url });
  } catch (error) {
    return json(502, { errors: [error instanceof Error ? error.message : 'GitHub content sync failed'] });
  }
}
