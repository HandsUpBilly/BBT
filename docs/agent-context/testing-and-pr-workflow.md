# Testing And PR Workflow

Primary files:

- `package.json` (root — the aggregate scripts)
- `client/package.json`, `client/vitest.config.ts`
- `client/src/*.test.ts`, `client/src/test/gameState.ts`
- `shared/*.test.js`
- `netlify/tests/*.test.js`
- `client/playwright.config.ts`, `client/e2e/`
- `AGENTS.md`

## Standard Checks

One command from the repo root runs everything:

```bash
npm run verify
```

That is `lint` → `test` (shared and Netlify, then client) → `build` →
`check:functions`. There is no hosted CI, so it is the only signal before
opening a PR — and `check:functions` is the step that matters, for the reason
below. It is not optional and it is not implied by the other three.

Individually:

```bash
npm run lint             # eslint over client/
npm test                 # node --test over shared/ and netlify/tests/, then vitest over client/
npm run build            # regenerates the scenario seed, then tsc -b && vite build
npm run check:functions  # bundles the Netlify functions as the deploy does
```

`check:functions` exists because lint, `tsc`, and every test pass on a
module-resolution break that still fails the deploy — a package imported from
`shared/` cannot resolve during function bundling. It deliberately refuses to
resolve above the repo root, so a stray `node_modules` in a parent directory
can't hide the problem locally.

## Mobile Layout Harness (Playwright)

```bash
npx playwright install     # once — fetches Chromium and WebKit
npm --prefix client run test:e2e          # full nine-device matrix
npm --prefix client run test:e2e:mobile   # the four phone profiles
```

`client/e2e/` asserts on measured geometry: square size, tap targets, HUD
budget, no clipping, no horizontal overflow, and the two-stage tap contract.

**Not wired into `npm run verify`, deliberately.** The specs need browser
binaries that `npm install` does not fetch, so including them would fail a
clean checkout for a reason unrelated to the change under test. Run them by
hand when touching game-screen layout, `Pitch.tsx`, or anything under a
`(pointer: coarse)` media query.

Why it exists: vitest runs in jsdom, which has no layout engine and measures
every box as 0×0. It cannot catch a single sizing regression. When the harness
was added it found 11.2px pitch squares, a 420px dialog on a 360px screen, and
260 squares rendered outside a wrapper with `overflow: hidden`.

Notes:

- Workers are capped and the timeout raised to 60s. Nine projects share one
  Vite dev server, and uncapped workers contend on it hard enough to time out
  `startGame()` and report failures that pass when run serially.
- Address squares by `data-square` ("13G"), not `aria-label` — the label gains
  the preview's roll details the moment a square is armed.
- "Did the piece move?" is not a valid commit assertion. A piece keeps its
  board position for the whole activation and is relocated only when the
  activation is finalised. Assert on spent MA and `.square--path`.

For docs-only changes, build/lint/test are not usually necessary, but at least
check `git diff --stat` and file paths.

## Test Layout

| Suite | Runner | Covers |
|---|---|---|
| `shared/*.test.js` | `node --test` | scenario validation, score validation, Google auth gating (including the fail-open cold-start warning), rate limiting and its bucket key, report formatting |
| `shared/statistics.test.js` | `node --test` | anonymous personal-best aggregation, identity deduplication, empty boards |
| `netlify/tests/blobEntries.test.js` | `node --test` | `updateEntries` etag retry loop, unconditional final-attempt write, `readEntries` corrupt/non-array handling |
| `netlify/tests/editorStore.test.js` | `node --test` | `toPublicView` published-only narrowing and dangling series id removal |
| `netlify/tests/leaderboardRateLimit.test.js` | `node --test` | the 429 path on both leaderboard functions: per-caller bucketing, `Retry-After`, invalid payloads not spending budget |
| `client/src/bfs.test.ts` | vitest | pathfinding, reachability, roll targets, pass ranges, block dice, pushes, zoom bounds |
| `client/src/useGameState.test.ts` | vitest | pass/handoff regressions, loose-ball pickup, touchdowns |
| `client/src/blockBlitz.test.ts` | vitest | block/blitz targeting, assists, outcomes, follow-ups |
| `client/src/activationRollback.test.ts` | vitest | cancel-rewind, ball-drop-on-knockdown, blitz movement cost |
| `client/src/auth.test.ts` | vitest | JWT decoding (UTF-8) and expiry |
| `client/src/editor/editorValidation.test.ts` | vitest | client/server validation parity, series resolution |
| `client/src/editor/AdminStatistics.test.tsx` | vitest | admin statistics loading and personal-best labeling |
| `client/src/blockControls.test.tsx` | vitest | menu placement, outcome selectability |
| `client/src/attemptStore.test.ts` | vitest | attempt recording, the per-puzzle cap, damaged/absent storage, trend maths |
| `client/src/AttemptHistory.test.tsx` | vitest | run table order, best marking, chart points, the chart's spoken label, clear-with-confirm |

**jsdom here has no Storage API.** `window.localStorage` is a bare object with
no `getItem`/`setItem`, so an unguarded access is a TypeError rather than a
miss — which is why every localStorage read in the client is wrapped, and why
the attempt-history suites install their own fake. vitest also runs without
`globals`, so Testing Library's automatic cleanup never registers: a suite that
renders more than once must call `cleanup()` itself or every query finds
duplicates.

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
