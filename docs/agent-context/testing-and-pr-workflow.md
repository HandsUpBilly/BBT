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
npm run test:shared      # shared node:test suites only
npm run test:functions   # Netlify node:test suites only
npm run test:client      # client vitest suites only
npm test                 # all three groups above
npm run build            # regenerates the scenario seed, then tsc -b && vite build
npm run check:functions  # bundles the Netlify functions as the deploy does
```

`check:functions` exists because lint, `tsc`, and every test pass on a
module-resolution break that still fails the deploy — a package imported from
`shared/` cannot resolve during function bundling. It deliberately refuses to
resolve above the repo root, so a stray `node_modules` in a parent directory
can't hide the problem locally.

### Development cadence

Do not run the aggregate suite after every edit or every user request. During
implementation, choose the narrowest useful check:

```bash
npm --prefix client run test:related -- src/useGameState.ts
npm --prefix client run test:changed
npm run test:shared
npm run test:functions
```

Run `npm run verify` once when a change is ready for a PR or final handoff. If
the user is batching a sequence of changes, wait for their explicit PR or
verification signal. A failing focused check should first be investigated in
that same scope; it is not a reason to launch every E2E project.

### Verification report contract

Every implementation handoff and PR summary includes a compact `Checks`
section. Report commands, outcomes, and omissions separately:

```text
Checks
- PASS — npm --prefix client run test:related -- src/useGameState.ts (18 tests)
- PASS — npm run lint
- NOT RUN — npm run verify; waiting for the requested PR checkpoint
- NOT RUN — Playwright; no browser geometry or input behaviour changed
```

Use `PASS`, `FAIL`, or `NOT RUN`; include test counts and duration when the
runner provides them. A check that only enumerates tests is reported as
`PASS (configuration only) — ... --list`, never as a test pass. If a command
runs several stages and stops early, identify the completed and failed stages
instead of summarising the whole command as passed. Do not claim “all tests
pass” unless the complete applicable suite ran successfully.

## Focused Browser Harness (Playwright)

```bash
npx playwright install                       # once — fetches browser binaries
npm --prefix client run test:e2e             # 10-case smoke gate
npm --prefix client run test:e2e:layout      # board geometry
npm --prefix client run test:e2e:input       # touch/mouse sizing
npm --prefix client run test:e2e:overlays    # menus, log, controls, block dialog
npm --prefix client run test:e2e:home        # identity gate and account screens
npm --prefix client run test:e2e:branches    # game-tree and player comparison
npm --prefix client run test:e2e:tutorial    # tutorial guide
npm --prefix client run test:e2e:admin       # puzzle creator
npm --prefix client run test:e2e:mobile      # all specs on one representative phone
npm --prefix client run test:e2e:full        # scheduled/release matrix only
```

`client/e2e/` asserts on measured geometry: square size, tap targets, HUD
budget, no clipping, no horizontal overflow, the plot-confirm contract, and
that toolbar panels fit their viewport without resizing the board.

Choose one command by the risk introduced, not by habit:

| Change area | Browser check |
|---|---|
| Rules, probability, validation, API, data, or copy | None; use a focused unit test |
| Pitch or game-screen geometry | `test:e2e:layout` |
| Pointer, hover, touch, or control sizing | `test:e2e:input` |
| Legend, action log, compact controls, block dialog | `test:e2e:overlays` |
| Login, home, help, settings | `test:e2e:home` |
| Branch review or player cards | `test:e2e:branches` |
| Tutorial flow | `test:e2e:tutorial` |
| Puzzle creator | `test:e2e:admin` |
| Small general browser confidence check | `test:e2e` |

Do not run Playwright merely because frontend code changed. Use it only when
the change materially depends on real browser geometry, viewport, input
capability, or a multi-screen browser flow.

**Not wired into `npm run verify`, deliberately.** The specs need browser
binaries that `npm install` does not fetch, so including them would fail a
clean checkout for a reason unrelated to the change under test. Run the
matching focused command by hand for those risks. The full matrix is not
routine PR validation.

Why it exists: vitest runs in jsdom, which has no layout engine and measures
every box as 0×0. It cannot catch a single sizing regression. When the harness
was added it found 11.2px pitch squares, a 420px dialog on a 360px screen, and
260 squares rendered outside a wrapper with `overflow: hidden`.

Notes:

- Workers are capped and the timeout raised to 60s. Projects share one
  Vite dev server, and uncapped workers contend on it hard enough to time out
  `startGame()` and report failures that pass when run serially.
- Address squares by `data-square` ("13G"), not `aria-label` — the label gains
  the preview's roll details the moment a square is armed.
- "Did the piece move?" is not a valid commit assertion. A piece keeps its
  board position for the whole activation and is relocated only when the
  activation is finalised. Assert on spent MA and `.square--path`.

### Scheduled/release matrix

The old config multiplied roughly 65 test declarations by 11 browser projects,
scheduling about 715 cases. Many then performed setup before discovering a
runtime `test.skip`, so they still consumed time without adding coverage.

`playwright.full.config.ts` uses a coverage matrix instead. Desktop and iPhone
SE are the broad representatives; Galaxy S8, landscape phone, tablet, desktop
touch, and the wide mobile-browser viewport run only the specs that can expose
their particular boundary. It currently schedules 232 cases instead of about
715 (68% fewer), preserving distinct geometry and input risks while removing
redundant mid-sized portrait-phone repetition.

The complete matrix is suitable for a daily job or explicit release check:

```bash
npm --prefix client run test:e2e:full
```

If a CI runner needs a shorter wall-clock time, split the same deterministic
matrix across jobs with Playwright sharding, for example `-- --shard=1/2` and
`-- --shard=2/2`. Do not promote a focused failure into this full run merely to
collect more output.

For docs-only changes, build/lint/test are not usually necessary, but at least
check `git diff --stat` and file paths.

## Test Layout

| Suite | Runner | Covers |
|---|---|---|
| `shared/*.test.js` | `node --test` | scenario validation, score validation, Google auth gating (including the fail-open cold-start warning), rate limiting and its bucket key, report formatting |
| `shared/statistics.test.js` | `node --test` | anonymous personal-best aggregation, identity deduplication, empty boards |
| `shared/analyticsValidation.test.js`, `shared/analyticsStatistics.test.js` | `node --test` | privacy allowlist, batch idempotency, session reduction, completion/drop-off funnels, stale-attempt inference |
| `netlify/tests/analyticsStore.test.js` | `node --test` | conflict-safe, idempotent game-session summary persistence |
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
| `client/src/analytics.test.ts`, `client/src/editor/AdminAnalytics.test.tsx` | vitest | disabled collection, stable retry batches, game-only dashboard cards/funnels/graphs, no GA audience duplication |
| `client/src/blockControls.test.tsx` | vitest | menu placement, outcome selectability |
| `client/src/LegendMenu.test.tsx` | vitest | key panel open/close/Escape-containment, contextual entries and the trigger count |
| `client/src/playerComparison.test.ts` | vitest | when the rail shows two cards, which is the acting one, and the single-card fallbacks |
| `client/src/PlayerPanel.test.tsx` | vitest | the Acting/Target captions and that both cards keep their stats |
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
