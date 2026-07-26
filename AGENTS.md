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

## Environment Variables

| Variable | Used in | Purpose |
|---|---|---|
| `PORT` | `server/index.js` | Express port (default: `3001`) |
| `NETLIFY_SITE_ID` / `SITE_ID` | `netlify/functions/leaderboard.js` | Netlify Blobs site ID |
| `NETLIFY_TOKEN` / `NETLIFY_AUTH_TOKEN` | `netlify/functions/leaderboard.js` | Netlify Blobs auth |

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
