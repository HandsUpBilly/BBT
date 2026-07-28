# Agent Guidelines


## Repository Layout

```
client/               React + TypeScript + Vite frontend
  src/
    scenarios/        JSON puzzle scenario definitions (add new .json files here)
    useGameState.ts   Core game logic hook
    bfs.ts            BFS pathfinding for movement
    types.ts          Shared TypeScript types
    api.ts            API client (fetchLeaderboard, submitScore)
server/               Express API — in-memory leaderboard (local dev only)
netlify/functions/    Netlify serverless leaderboard (production, uses Netlify Blobs)
```

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

## Build

```bash
# From repo root
npm run build

# Or directly
cd client && npm run build   # runs tsc -b && vite build; output → client/dist/
```

## Lint

```bash
cd client && npm run lint    # ESLint on all *.ts / *.tsx files
```

Run lint before committing. There is no separate formatter configured.

## TypeScript / JavaScript

- **Never leave unused variables or imports.** The build runs `tsc -b` with `noUnusedLocals: true` and `noUnusedParameters: true` — unused symbols are a build error.
- `tsc -b` is type-check only; Vite handles emit.

## Adding Scenarios

Drop a new `.json` file in `client/src/scenarios/`. It is picked up automatically via `import.meta.glob` — no import registration needed.

## Architecture Notes

- **Local dev** uses the Express server (`server/index.js`) with an in-memory store.
- **Production** (Netlify) uses `netlify/functions/leaderboard.js` backed by Netlify Blobs.
- No monorepo tooling (no workspaces, Turborepo, etc.) — each package is managed independently.

## Agent Context Docs

Before broad source inspection, read the smallest matching doc in
`docs/agent-context/`:

| Task area | Read |
|---|---|
| Home screen, app modes, navigation, identity gate | `docs/agent-context/frontend-flow.md` |
| Movement, dodges, pass, handoff, dice logging | `docs/agent-context/game-rules-engine.md` |
| Scenario JSON, published puzzles, series order | `docs/agent-context/scenarios-and-series.md` |
| Google login, guest identity, leaderboards | `docs/agent-context/leaderboard-and-auth.md` |
| Admin Mode, puzzle editor, local save API | `docs/agent-context/puzzle-editor.md` |
| Netlify build, redirects, production functions | `docs/agent-context/netlify-deploy.md` |
| Verification commands, tests, PR conflicts | `docs/agent-context/testing-and-pr-workflow.md` |

Keep durable shipped behavior in these docs. Keep future plans in `spec.md`.

## Environment Variables

| Variable | Used in | Purpose |
|---|---|---|
| `PORT` | `server/index.js` | Express port (default: `3001`) |
| `NETLIFY_SITE_ID` / `SITE_ID` | `netlify/functions/leaderboard.js` | Netlify Blobs site ID |
| `NETLIFY_TOKEN` / `NETLIFY_AUTH_TOKEN` | `netlify/functions/leaderboard.js` | Netlify Blobs auth |
| `ADMIN_EMAILS` | `server/auth.js`, `netlify/functions/auth.js` | Comma-separated allowlist gating `/api/editor/*` writes. Unset = unrestricted (matches pre-admin-gating behavior). |
| `VITE_ADMIN_EMAILS` | `client/src/App.tsx` | Same list, client-side, controls Admin Mode button visibility only — not a security boundary. Keep in sync with `ADMIN_EMAILS`. |

## Puzzle Editor: Draft vs. Published Scenarios

On Netlify, the editor (`client/src/editor/PuzzleEditor.tsx`) reads/writes
**draft** scenario/series state in Netlify Blobs
(`netlify/functions/editor-scenarios.js`, `editor-series.js`,
`editorStore.js`). Draft saves never reach players directly.

Players' clients fetch the **published** state at runtime from the public,
unauthenticated `GET /api/scenarios` endpoint
(`netlify/functions/scenarios.js` in production, an equivalent route in
`server/editor.js` for local dev) — see `client/src/scenarios/runtime.ts`
(`loadScenarioData`), called from `App.tsx`. If that fetch fails, the app
falls back to the build-time static bundle (`client/src/scenarios/*.json`
via `import.meta.glob`, `client/src/series/default.json`).

The editor's **Publish** button (`publishEditorData` in
`client/src/editor/editorApi.ts` → `POST /api/editor/publish` →
`netlify/functions/editor-publish.js`) copies draft → published Blobs
keys. This is an explicit action so an admin can stage multiple edits
before making them live — publishing is NOT automatic on every draft save.

Local dev has no draft/published split: `server/editor.js` writes straight
to `client/src/scenarios/*.json` / `client/src/series/default.json`
(already "live" for local dev), and its `/api/editor/publish` route is a
no-op confirmation kept only so the client's publish button works
identically in both environments.

Write endpoints (`POST`/`PUT` on `/api/editor/*`, plus
`/api/editor/publish`) require `requireAdminGoogleUser` — a Google ID
token (sent as `Authorization: Bearer <idToken>`, added by
`editorApi.ts`'s `authHeaders`) whose email is in `ADMIN_EMAILS`. See
"Identity / Auth Notes" below for how ID tokens are obtained.

## Leaderboard Eventual-Consistency Pattern

Netlify Blobs (production backing store) is not immediately read-consistent
after a write. Both the individual leaderboard (`handleSubmit`) and the
series leaderboard (`handleSeriesContinue`) in `App.tsx` follow the same
submit flow — replicate this pattern for any new leaderboard-writing flow:

1. Submit the score.
2. Do local bookkeeping (remember local score id, set highlight, reset game
   phase) and switch to the leaderboard view immediately.
3. `await new Promise(res => setTimeout(res, 3000))` before refetching —
   gives the store time to become consistent.
4. Explicitly refetch and store the result in an `initialEntries` state.
5. Bump a `refreshKey` state used as the leaderboard component's React `key`
   prop, forcing a clean remount with the fresh data.

## Identity / Auth Notes

- Google Sign-In uses Google Identity Services (`https://accounts.google.com/gsi/client`),
  driven through `window.google.accounts.id.{initialize,prompt,disableAutoSelect}`.
  JWT credentials are decoded client-side (`decodeJwtPayload` in `auth.ts`)
  and verified server-side via `google-auth-library`'s `OAuth2Client.verifyIdToken`
  (`server/auth.js`).
- Login persists across refresh: `AuthProvider.tsx` caches `{user, idToken}`
  in `localStorage` (`bbt.auth.v1`) and attempts a silent Google re-auth on
  mount (`auto_select: true`, `cancel_on_tap_outside: false`); if silent
  re-auth fails it falls back to the cached session rather than forcing a
  fresh login.
- Guest names persist the same way via `localStorage` key `bbt.guestName.v1`
  (see `readGuestName`/`writeGuestName` in `App.tsx`).
- `LeaderboardEntry`/`SeriesLeaderboardEntry` (`types.ts`) carry optional
  `userId`, `authProvider`, `displayName`, `avatarUrl` — already threaded
  through the backend (`entryAuthFields()` in `server/auth.js`). The `UserMenu`
  component (`UserMenu.tsx`) and both leaderboard tables render the avatar
  (or initials fallback via a shared `initials(name)` helper) when present.
- `IdentityGate` (in `App.tsx`) gates all UI behind `identityReady` — true
  once a Google user or a non-empty guest name exists.
- `requireAdminGoogleUser` (`server/auth.js`, `netlify/functions/auth.js`)
  reuses the same `verifyOptionalGoogleUser` token verification, then checks
  the verified email against `ADMIN_EMAILS`. Throws `AdminAuthError` (401 if
  not signed in, 403 if signed in but not allowlisted) — guest sessions have
  no ID token and can never pass this check, only Google-signed-in admins can.

## Scenario Naming

Scenario `name`/`description` fields in `client/src/scenarios/*.json` are
the single source of truth for both the challenge-select screen
(`ScenarioSelect.tsx`) and the leaderboard (`Leaderboard.tsx`). Don't
reintroduce a screen-specific title override map — a prior `CHALLENGE_COPY`
override caused the two screens to show different names for the same
puzzle and was removed for this reason. All five scenarios use Blood Bowl
lore-flavored names/descriptions (human team: "the Reavers", featuring
Aldric Swiftfoot / Sera Quickhand vs. Grukk Ironjaw's Orcs).

## Git Workflow Gotchas Seen in This Repo

- No hosted CI — `npm run build` + `npm run lint` in `client/` are the only
  verification signal before opening a PR.
- When rebasing a long-lived feature branch onto `main` after other PRs
  merged, conflicts in `App.tsx` are common (many features touch the same
  top-level component) — usually just import-line or hook-dependency-array
  merges; check the file compiles and lints clean after resolving.
- Terminal has no `$EDITOR` configured — use `GIT_EDITOR=true git rebase --continue`
  (or `-m`/`-F`) instead of relying on an interactive commit-message editor.
- Use `git push --force-with-lease` (not plain `--force`) after a rebase.
