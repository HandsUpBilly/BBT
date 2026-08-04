# Netlify Deploy

Primary files:

- `netlify.toml`
- `netlify/functions/*.js`
- `netlify/functions/package.json`
- `scripts/generate-scenario-seed.mjs`
- `shared/` (imported by the functions)

## Build

```toml
[build]
  base    = "client"
  command = "npm install && npm run generate:seed && npm run build && cd ../netlify/functions && npm install"
  publish = "dist"
```

`generate:seed` regenerates `netlify/functions/scenarioSeed.js` from
`client/src/scenarios/*.json`. esbuild can't glob, so the Blobs seed needs a
literal import list; generating it keeps "drop a JSON file in `scenarios/`" true
in both environments. Never hand-edit that file.

Functions live in `netlify/functions/` and are bundled with esbuild. They import
from `shared/` at the repo root, which is what keeps the production
auth/validation identical to the Express server's.

### shared/ must not import any package

esbuild resolves bare imports relative to the *importing file*. `shared/` is not
an ancestor of `netlify/functions/node_modules`, so a package import there
cannot resolve during bundling:

```
✘ [ERROR] Could not resolve "google-auth-library"
    ../shared/googleAuth.js:9:29
```

Inject the dependency from the target instead — `makeGoogleTokenVerifier` takes
the `OAuth2Client` class as a parameter, and `netlify/functions/auth.js` imports
the library itself.

The build command runs `scripts/check-function-bundles.mjs` after the functions'
`npm install`, so this fails with a clear message during the build command
rather than as a raw esbuild error in the bundling stage. It also runs locally
via `npm run check:functions` / `npm run verify`, and refuses to resolve above
the repo root — a stray `node_modules` in a parent directory otherwise hides the
problem on a developer machine while Netlify's clean checkout still fails.

## Redirects

All configured in `netlify.toml`, in this order:

| Path | Function | Auth |
|---|---|---|
| `/api/leaderboard/*` | `leaderboard` | Optional Google (guest allowed) |
| `/api/series-leaderboard` | `series-leaderboard` | Optional Google (guest allowed) |
| `/api/progress` | `progress` | Public |
| `/api/reports` | `reports` | Optional Google, rate-limited |
| `/api/editor/statistics` | `editor-statistics` | **Admin only** |
| `/api/editor/scenarios` | `editor-scenarios` | **Admin only, including GET** |
| `/api/editor/scenarios/*` | `editor-scenarios` | **Admin only** |
| `/api/editor/series/default` | `editor-series` | **Admin only** |
| `/api/editor/publish` | `editor-publish` | **Admin only** |
| `/api/scenarios` | `scenarios` | Public (published state only) |
| `/*` | SPA fallback | — |

`/api/progress` returns every scenario board plus the series board in one
response. The home screen used to fire one request per scenario *and* run the
whole fan-out twice per visit (the scenario array identity changes when the
runtime fetch resolves), which was 12 function invocations for five puzzles.

## Headers

`netlify.toml` sets a CSP allowing only what the app actually loads — the Google
Identity Services script, its frame, and Google avatar images — plus
`X-Frame-Options: DENY`, `nosniff`, a `Referrer-Policy`, and a `Permissions-Policy`.
The CSP matters here specifically because the Google ID token is cached in
`localStorage`; a strict `connect-src` leaves an injected script nowhere to send it.

Hashed assets under `/assets/*` are immutable-cached; `index.html` is `no-cache`
so a deploy is picked up on the next load.

## Environment Variables

Required for Google login:

- `VITE_GOOGLE_CLIENT_ID` (build) — client-side Sign-In
- `GOOGLE_CLIENT_ID` (functions) — server-side token verification

Required for Netlify Blobs (leaderboards + editor drafts):

- `NETLIFY_SITE_ID` or `SITE_ID`
- `NETLIFY_TOKEN` or `NETLIFY_AUTH_TOKEN`

Required to gate the puzzle editor:

- `ADMIN_EMAILS` (functions) — comma-separated allowlist
- `VITE_ADMIN_EMAILS` (build) — same list, controls tab visibility only

Required for player-created GitHub issues:

- `GITHUB_ISSUES_TOKEN` — fine-grained token scoped to `HandsUpBilly/BBT` with
  **Issues: Read and write**. Configure as a Netlify secret; never expose it as
  a `VITE_` variable.

Google OAuth must include the deployed Netlify origin in its authorized
JavaScript origins.

### Editor access defaults open without an allowlist

`netlify/functions/auth.js` and `server/auth.js` both treat an empty or unset
`ADMIN_EMAILS` as unrestricted Admin Mode. Once the allowlist contains an
address, every `/api/editor/*` route requires a verified matching Google user.
Set `EDITOR_ALLOW_UNAUTHENTICATED=false` to opt a deployment into returning 503
when its allowlist is empty.

## Blobs Concurrency

`netlify/functions/blobEntries.js` wraps leaderboard reads/writes with
`getWithMetadata` + `onlyIfMatch`, retrying on a conflicting etag. Blobs has no
transactions, so a plain read-modify-write silently lost one of two concurrent
submissions. The final retry writes unconditionally so a store whose etag can
never be read still converges instead of rejecting every submission forever.

Blobs is also not immediately read-consistent after a write — that is handled
client-side by the delayed refetch in `App.tsx`.

`netlify/functions/editorStore.js` self-heals a Blobs `scenarios`/`series-default`
key (draft or published) that was first seeded before a new scenario existed in
`STATIC_SCENARIOS`: on every read it appends any shipped scenario missing
entirely from the stored array, and separately swaps a still-present editor
placeholder for the shipped seed. Add a new scenario's id to both
`repairScenario006Placeholder`-style checks if this pattern needs to repeat —
otherwise an old Blobs snapshot can silently hide a newly shipped puzzle from
Admin Mode and players.

## Current Production Capabilities

- Static game frontend
- Google/guest identity
- Individual + series leaderboards, with server-side score validation
- Combined home-screen progress endpoint
- Player issue and feature reporting via `/api/reports`, rate-limited
- Admin-only anonymous player-performance statistics from the full retained
  personal-best leaderboards
- **Persistent puzzle-editor saves** via Netlify Blobs, with an explicit
  draft → published publish step
