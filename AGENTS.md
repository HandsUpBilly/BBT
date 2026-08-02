# Agent Guidelines

## Core Concept

**A puzzle is always exactly one turn.** You activate each piece once, and the
run ends when the ball reaches the end zone. There is no End Turn, no turn
counter, no halves, and no running score. The cumulative probability of every
roll you commit to *is* the score, so anything that would let a player bank a
turn and start fresh would also reset that chain. Free Play was removed for this
reason — don't reintroduce it.

## Repository Layout

```
client/               React + TypeScript + Vite frontend
  src/
    scenarios/        JSON puzzle scenario definitions (add new .json files here)
    useGameState.ts   Core game logic hook
    bfs.ts            Pathfinding, dodge/pass/block maths
    types.ts          Shared TypeScript types
    api.ts            API client (leaderboards, progress, reports)
    test/             Test fixtures shared across the vitest suites
shared/               Validation + auth + reporting used by ALL THREE targets
server/               Express API — local dev leaderboard + puzzle editor
netlify/functions/    Netlify serverless functions (production)
scripts/              Build-time codegen (scenario seed) and one-shot helpers
docs/agent-context/   Durable facts about shipped behavior — read these first
spec.md               Feature plans and shipped history, each with a Status line
```

### `shared/` is the anti-drift layer

`shared/` holds the logic that must behave identically in the browser, in
Express, and in Netlify Functions. It used to be copy-pasted across all three,
with a comment admitting it was "kept in sync manually" — and it had already
drifted (the client's scenario validator silently skipped stat ranges, so the
editor accepted drafts the server then rejected).

| Module | Used by |
|---|---|
| `scenarioValidation.js` | client editor, `server/editor.js`, `editor-scenarios.js` |
| `googleAuth.js` | `server/auth.js`, `netlify/functions/auth.js` |
| `reporting.js` | client download fallback, both `/api/reports` implementations |
| `githubIssues.js` | both `/api/reports` implementations (server-only) |
| `scoreValidation.js` | both leaderboard implementations |
| `rateLimit.js` | both `/api/reports` implementations |

They are plain ESM `.js` with hand-written `.d.ts` siblings so TypeScript can
consume them. **Do not fork these into a package-local copy.** Vite is
configured with `server.fs.allow: ['..']` so the client can import them.

### Nothing in `shared/` may import a package

`shared/` must stay dependency-free. Module resolution walks up from the
*importing file*, and `shared/` is not an ancestor of `server/node_modules`,
`netlify/functions/node_modules`, or `client/node_modules` — so a bare import
there resolves from none of them. Moving `google-auth-library` into
`shared/googleAuth.js` passed lint, `tsc`, and every test, then failed the
Netlify deploy with `Could not resolve "google-auth-library"`.

Inject the dependency from the target instead. `makeGoogleTokenVerifier` takes
the `OAuth2Client` *class* as a parameter; `server/auth.js` and
`netlify/functions/auth.js` each import the library themselves, from a
directory where it resolves.

`npm run check:functions` bundles every function the way Netlify does and fails
on any package that can't be resolved from inside the repo. It runs as part of
`npm run verify` and in the Netlify build command.

> **Local-environment trap:** a stray `node_modules` in a parent directory (a
> home-directory install, for example) satisfies the walk-up on your machine
> while Netlify's clean `/opt/build/repo` checkout has no such ancestor. That is
> exactly how this reached production. `check:functions` deliberately refuses to
> look above the repo root, so it catches this locally.

## Setup

Each package has its own `node_modules`. Install separately:

```bash
cd client && npm install
cd server && npm install
cd netlify/functions && npm install
```

## Dev Server

Both services must run together — Vite proxies `/api/*` → `http://localhost:3001`.

```bash
# Terminal 1 — Express API (port 3001)
cd server && node index.js

# Terminal 2 — Vite frontend (port 5173)
cd client && npm run dev
```

In Gitpod, both services start automatically on container start.

## Verify

One command from the repo root runs lint, both test suites, and the build:

```bash
npm run verify
```

Individually:

```bash
npm run lint             # ESLint over client/
npm test                 # node --test over shared/, then vitest over client/
npm run build            # regenerates the scenario seed, then tsc -b && vite build
npm run check:functions  # bundles the Netlify functions as the deploy does
```

There is no hosted CI, so `npm run verify` is the only signal before opening a
PR. Note that `lint`, `tsc`, and the tests all pass on a module-resolution break
that fails the deploy — `check:functions` is the step that catches it.

## TypeScript / JavaScript

- **Never leave unused variables or imports.** The build runs `tsc -b` with
  `noUnusedLocals` and `noUnusedParameters` — unused symbols are a build error.
- `tsc -b` is type-check only; Vite handles emit.
- ESLint enforces the React Hooks rules, including "no refs during render" and
  "useMemo takes an inline function".

## Adding Scenarios

Drop a new `.json` file in `client/src/scenarios/`. Two consumers pick it up:

- the client, automatically, via `import.meta.glob`;
- the Netlify functions, via `netlify/functions/scenarioSeed.js`, which is
  **generated** from those JSON files by `scripts/generate-scenario-seed.mjs`.

`npm run build` and the Netlify build command both regenerate the seed, so no
manual import registration is needed. (esbuild can't glob, so before the
generator existed this file was a hand-maintained import list — a new scenario
worked locally and then silently vanished from the Netlify seed.)

Never hand-edit `netlify/functions/scenarioSeed.js`.

Two skills in `.claude/skills/` cover this workflow end to end:

- **`new-scenario`** — board/roster reference and the authoring workflow, plus
  `scripts/validate-scenarios.mjs`, which runs `shared/scenarioValidation.js` over
  every scenario and the series and exits non-zero on failure.
- **`audit-scenario`** — `scripts/audit-scenario.mjs` enumerates and prices every
  scoring line in a puzzle (runs, passes, handoffs, blitzes, and the block openings
  that unlock them). It imports `client/src/bfs.ts` directly so the maths cannot
  drift from the engine. Run it on any scenario you add or change.

## Environment Variables

| Variable | Used in | Purpose |
|---|---|---|
| `PORT` | `server/index.js` | Express port (default: `3001`) |
| `GOOGLE_CLIENT_ID` | `shared/googleAuth.js` | Server-side ID token verification |
| `VITE_GOOGLE_CLIENT_ID` | `AuthProvider.tsx` | Client-side Google Sign-In |
| `NETLIFY_SITE_ID` / `SITE_ID` | Netlify functions | Netlify Blobs site ID |
| `NETLIFY_TOKEN` / `NETLIFY_AUTH_TOKEN` | Netlify functions | Netlify Blobs auth |
| `ADMIN_EMAILS` | `shared/googleAuth.js` | Comma-separated allowlist gating `/api/editor/*` |
| `VITE_ADMIN_EMAILS` | `client/src/App.tsx` | Same list, controls Admin Mode tab visibility only — not a security boundary |
| `EDITOR_ALLOW_UNAUTHENTICATED` | `shared/googleAuth.js` | Escape hatch when no allowlist is set. Defaults **true** locally, **false** on Netlify |
| `GITHUB_ISSUES_TOKEN` | `shared/githubIssues.js` | Fine-grained token, `HandsUpBilly/BBT` + Issues:RW. Server-only — never a `VITE_` var |
| `VITE_APP_VERSION` / `COMMIT_REF` | `vite.config.ts` | Build identifier shown in the masthead and attached to reports |

### Editor auth fails closed in production

If `ADMIN_EMAILS` is unset, `requireAdminGoogleUser` used to return `null` —
meaning a forgotten env var turned the deployed puzzle editor into a
world-writable endpoint. Now:

- **Local dev** defaults to allowing unauthenticated editor writes, so the
  editor works without any OAuth setup. Set `EDITOR_ALLOW_UNAUTHENTICATED=false`
  to exercise production behavior.
- **Netlify** fails closed: no allowlist means `/api/editor/*` returns 503.

`GET /api/editor/scenarios` is admin-gated too — it returns *drafts*, including
unpublished puzzles. Only `GET /api/scenarios` (published state) is public.

## Agent Context Docs

Before broad source inspection, read the smallest matching doc in
`docs/agent-context/`:

| Task area | Read |
|---|---|
| Home screen, app modes, navigation, identity gate | `frontend-flow.md` |
| Movement, dodges, pass, handoff, blocks, dice logging | `game-rules-engine.md` |
| Scenario JSON, published puzzles, series order | `scenarios-and-series.md` |
| Google login, guest identity, leaderboards, score integrity | `leaderboard-and-auth.md` |
| Admin Mode, puzzle editor, local save API | `puzzle-editor.md` |
| Netlify build, redirects, production functions | `netlify-deploy.md` |
| Verification commands, tests, PR conflicts | `testing-and-pr-workflow.md` |

Keep durable shipped behavior in these docs. Keep plans in `spec.md` — every
section there carries a **Status** line, so check it before treating a section
as outstanding work.

## Puzzle Editor: Draft vs. Published Scenarios

On Netlify, the editor reads/writes **draft** scenario/series state in Netlify
Blobs (`editor-scenarios.js`, `editor-series.js`, `editorStore.js`). Draft saves
never reach players directly.

Players' clients fetch the **published** state at runtime from the public
`GET /api/scenarios` endpoint — see `client/src/scenarios/runtime.ts`. If that
fetch fails, the app falls back to the build-time static bundle.

The editor's **Publish** button copies draft → published Blobs keys. It is an
explicit action (now behind a confirmation dialog) so an admin can stage several
edits before making them live.

Published views narrow `series.scenarioIds` to scenarios that survive the
`published !== false` filter — otherwise disabling a puzzle still listed in the
series would silently shorten a series run mid-play.

Local dev has no draft/published split: `server/editor.js` writes straight to
`client/src/scenarios/*.json`, and its `/api/editor/publish` route is a no-op
confirmation kept only so the client's publish button works identically in both
environments.

## Leaderboard Notes

**Eventual consistency.** Netlify Blobs is not immediately read-consistent after
a write. Both submit flows in `App.tsx` follow the same pattern — replicate it
for any new leaderboard-writing flow:

1. Submit the score.
2. Do local bookkeeping and switch to the leaderboard view.
3. `await new Promise(res => setTimeout(res, LEADERBOARD_CONSISTENCY_DELAY_MS))`.
4. Explicitly refetch into an `initialEntries` state.
5. Bump a `refreshKey` used as the component's React `key`, forcing a remount.

**Storage keeps everything; only reads truncate.** Trimming the stored array
deleted a player's personal best the moment they fell out of the visible table.

**Personal bests only.** `upsertPersonalBest` never lets a worse run replace a
better one.

**Submissions are validated, not trusted.** `shared/scoreValidation.js` bounds
the numbers and checks the claimed probability against the product of the
submitted move probabilities. It is explicitly **not** cheat-proof: a forged
clean run (`probability: 1, diceCount: 0, moves: []`) is accepted, because a
genuine no-roll solution scores exactly that. See spec.md "Leaderboard and
Report Integrity" for what a real fix needs.

**Failures are surfaced.** Submit errors used to be swallowed by a bare `catch`,
so a failed submission looked exactly like a success with a missing score. The
`SubmitModal` now takes an `error` prop and offers a retry.

## Identity / Auth Notes

- Google Sign-In uses Google Identity Services. JWT payloads are decoded
  client-side (`decodeJwtPayload` in `auth.ts`, UTF-8 aware) and verified
  server-side via `google-auth-library` in `shared/googleAuth.js`.
- **Tokens expire after ~1 hour.** `isTokenExpired` checks `exp` with a 60s skew
  allowance; an expired token is never sent, `sessionExpired` surfaces a
  "sign in again" banner, and the cached user is kept so the identity gate
  doesn't kick the player back to the login screen.
- Only `email_verified` addresses are trusted for the admin allowlist.
- Login persists via `localStorage` (`bbt.auth.v1`), with a silent Google
  re-auth attempt on mount.
- Guest names persist via `bbt.guestName.v1`.
- `IdentityGate` (in `App.tsx`) gates all UI behind `identityReady`.

## Accessibility Notes

- Pitch squares are keyboard-operable (`role="button"`, Enter/Space) with
  `aria-label`s describing the square, its occupant, and any pending rolls.
  Only *actionable* squares are in the tab order, so keyboard users aren't
  forced through 390 inert cells.
- All modals use `useModalFocus`, which traps Tab, wires Escape, and restores
  focus to whatever opened the dialog.

## Scenario Naming

Scenario `name`/`description` fields in `client/src/scenarios/*.json` are the
single source of truth for both the challenge-select screen and the leaderboard.
Don't reintroduce a screen-specific title override map — a prior `CHALLENGE_COPY`
override caused the two screens to show different names for the same puzzle and
was removed for this reason.

## Git Workflow Gotchas Seen in This Repo

- When rebasing a long-lived feature branch onto `main` after other PRs merged,
  conflicts in `App.tsx` are common (many features touch the same top-level
  component) — usually just import-line or hook-dependency-array merges; run
  `npm run verify` after resolving.
- Terminal has no `$EDITOR` configured — use `GIT_EDITOR=true git rebase --continue`
  (or `-m`/`-F`) instead of relying on an interactive commit-message editor.
- Use `git push --force-with-lease` (not plain `--force`) after a rebase.
