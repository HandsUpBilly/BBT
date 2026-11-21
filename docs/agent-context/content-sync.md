# Turn 16 content workflow (v3)

## Sources and conflict policy

**GitHub is the reviewed baseline.** `client/src/scenarios/*.json` and
`client/src/series/*.json` are compiled into `scenarioSeed.js` on every
build. Netlify Blobs contains the **editable live overlay**. Neither source
silently overwrites the other.

At first read, `content-v3/catalog` is seeded from the legacy editor
collections on production, retaining saved changes. The old keys remain
untouched as a recovery snapshot. Branch deploys and deploy previews use
separate v3 keys and are initially seeded from their bundled GitHub content,
not the shared production editor store.

A subsequent deploy performs a deterministic three-way reconciliation:

- GitHub changed a field, editor did not: take GitHub.
- Editor changed a field, GitHub did not: keep editor.
- Both changed different fields or different player properties: merge.
- Both changed the same value incompatibly: retain the editor value and
  report an exact conflict path to administrators.
- Editor removed an item: retain the tombstone; future GitHub additions or
  modifications are not allowed to silently resurrect it.

There are no per-release ID allowlists or manual expansion migrations after
v3 bootstraps. The legacy migration helpers remain only to import an existing
pre-v3 Blob collection, including its historical one-off migrations.

## Live Puzzle Creator

**Save Draft** modifies the private editor revision only. **Publish Draft**
uses a separate CAS guarded by draft and published revisions and updates the
public snapshot. Unpublish requires saving `published=false` and then
publishing that change. Explicit confirmed Delete is destructive and removes
the item from public play immediately; old leaderboards are retained.
The existing `published` and `adminEnabled` flags still express the intended
visibility of a saved draft. Each item has an optimistic revision,
and every write uses Netlify's atomic `onlyIfMatch` ETag. Stale editor tabs
receive HTTP 409 and must reload before saving. Writes to different items
retry independently, avoiding the old full-collection lost-update problem.
Deleting a puzzle updates the series references atomically in the same CAS.

The admin editor shows a conflict warning and offers **Review Live Changes in
GitHub**. This creates a pull request to `staging` containing only changes
since the deployed GitHub baseline. Before committing, it fetches the current
staging versions of the affected files and three-way merges again. If
conflicting edits exist, it returns HTTP 409 instead of opening an overwrite
PR. Merge the PR after verification; the next deployment will recognise the
same content and the item becomes clean.

The GitHub export endpoint needs a **new** server-only Netlify environment
variable `GITHUB_CONTENT_SYNC_TOKEN`, a fine-grained GitHub token restricted
to `HandsUpBilly/BBT` with **Contents: Read and write** and
**Pull requests: Read and write**. Never use `GITHUB_ISSUES_TOKEN` (its scope
is inadequate), never create a `VITE_` token, and never expose this value to
the browser. Without this token, editor saves still work and PR export returns
an explicit HTTP 503; it must not silently pretend to have synced.

## Migration and verification

1. Back up the current `editor-drafts` store using an administrator-owned
   export before the first production deployment. Do not reset rankings.
2. Deploy on a Netlify branch deploy first and confirm the v3 isolated key
   reads the expected bundled series and puzzles without modifying production.
3. Test two concurrent writes to different puzzles, two simultaneous writes
   to the same puzzle, deletion and restoring a saved item; verify HTTP 409 for
   stale revisions.
4. Test GitHub-only updates, editor-only updates and incompatible simultaneous
   edits in a preview. Inspect the conflict paths in the editor.
5. Verify Save Draft does not change public API responses, Publish Draft does,
   and stale published revisions are rejected. Ensure old v3 snapshots are
   upgraded without exposing unpublished editor content.
6. Configure `GITHUB_CONTENT_SYNC_TOKEN`, open a PR from the live editor,
   verify the PR contains only intended content files and merge into staging.
7. Run `npm run verify`, test the browser editor and public scenario endpoint,
   and then promote to production. Check that edited live puzzles survive
   a redeploy and new repo-authored puzzles appear on the next read.

## Important limitations

The v3 catalog is a **single CAS-protected snapshot** with item-level
revisions, rather than one Blob key per puzzle. This keeps the public API
atomic and avoids 25+ reads per page load, while providing independent item
optimistic concurrency. The retained history is a bounded (40-entry) record
of prior values inside the snapshot. The Puzzle Editor offers a bounded in-app revision history and rollback,
using the same CAS guard to prevent restoring over someone else's changes.
Drafts and published revisions have separate optimistic revision numbers;
GitHub deployments reconcile both against the previous baseline, while
retaining unpublished saved edits. Public scenario, progress and statistics
endpoints read only the published snapshot. Bulk GitHub export remains a
reviewable explicit action, not an unreviewed production push. Automatically
scheduled GitHub PR creation is not part of this release.
