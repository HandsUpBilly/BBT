# Testing And PR Workflow

Primary files:

- `package.json` (root — the aggregate scripts)
- `client/package.json`, `client/vitest.config.ts`
- `client/src/*.test.ts`, `client/src/test/gameState.ts`
- `shared/*.test.js`
- `AGENTS.md`

## Standard Checks

One command from the repo root runs everything:

```bash
npm run verify
```

That is `lint` → `test` (shared, then client) → `build`. There is no hosted CI,
so it is the only signal before opening a PR.

Individually:

```bash
npm run lint             # eslint over client/
npm test                 # node --test over shared/, then vitest over client/
npm run build            # regenerates the scenario seed, then tsc -b && vite build
npm run check:functions  # bundles the Netlify functions as the deploy does
```

`check:functions` exists because lint, `tsc`, and every test pass on a
module-resolution break that still fails the deploy — a package imported from
`shared/` cannot resolve during function bundling. It deliberately refuses to
resolve above the repo root, so a stray `node_modules` in a parent directory
can't hide the problem locally.

For docs-only changes, build/lint/test are not usually necessary, but at least
check `git diff --stat` and file paths.

## Test Layout

| Suite | Runner | Covers |
|---|---|---|
| `shared/*.test.js` | `node --test` | scenario validation, score validation, Google auth gating, rate limiting, report formatting |
| `shared/statistics.test.js` | `node --test` | anonymous personal-best aggregation, identity deduplication, empty boards |
| `client/src/bfs.test.ts` | vitest | pathfinding, reachability, roll targets, pass ranges, block dice, pushes, zoom bounds |
| `client/src/useGameState.test.ts` | vitest | pass/handoff regressions, loose-ball pickup, touchdowns |
| `client/src/blockBlitz.test.ts` | vitest | block/blitz targeting, assists, outcomes, follow-ups |
| `client/src/activationRollback.test.ts` | vitest | cancel-rewind, ball-drop-on-knockdown, blitz movement cost |
| `client/src/auth.test.ts` | vitest | JWT decoding (UTF-8) and expiry |
| `client/src/editor/editorValidation.test.ts` | vitest | client/server validation parity, series resolution |
| `client/src/editor/AdminStatistics.test.tsx` | vitest | admin statistics loading and personal-best labeling |
| `client/src/blockControls.test.tsx` | vitest | menu placement, outcome selectability |

`client/src/test/gameState.ts` builds test states from `makeEmptyState()` rather
than a hand-written literal, so adding a `GameState` field doesn't require
editing every test file — the old literals had to be updated in lockstep and
drifted.

Node's test runner needs a glob here (`node --test shared/*.test.js`); passing a
bare directory fails on current Node.

## Package Layout

Dependencies are installed separately — there is no workspace tooling:

```bash
cd client && npm install
cd server && npm install
cd netlify/functions && npm install
```

`shared/` has no dependencies of its own and is imported directly by all three.
Vite needs `server.fs.allow: ['..']` for the client to reach it; that is already
configured.

## Common Conflicts

`App.tsx` is the common conflict point because many features touch:

- imports,
- identity/user menu,
- app mode render branches,
- series submit flow,
- editor preview flow.

After resolving `App.tsx`, run `npm run verify`.

## Git Notes

- The terminal may not have `$EDITOR`; use `GIT_EDITOR=true git rebase --continue`.
- After rebasing a PR branch, push with `git push --force-with-lease`.
- Preserve unrelated local changes with `git stash push -- <path>` before merges.
- Do not include local editor-generated scenario drafts in unrelated conflict
  resolution commits.
- `netlify/functions/scenarioSeed.js` is generated. If it conflicts, take either
  side and re-run `npm run generate:seed`.

## PR Documentation Rule

If a PR changes durable behavior documented under `docs/agent-context/`, update
the matching doc in the same PR. If it ships something planned in `spec.md`,
update that section's **Status** line too.
