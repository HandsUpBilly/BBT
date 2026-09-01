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
  command = "npm install && npm run generate:seed && npm run build && cd ../netlify/functions && npm install && node ../../scripts/check-function-bundles.mjs"
  publish = "dist"
```

`generate:seed` regenerates `netlify/functions/scenarioSeed.js` from
`client/src/scenarios/*.json`. esbuild can't glob, so the Blobs seed needs a
literal import list; generating it keeps "drop a JSON file in `scenarios/`" true
in both environments. Never hand-edit that file.

Deployable functions live in `netlify/functions/`; their Node tests live in
`netlify/tests/` so Netlify never mistakes a `*.test.js` file for a serverless
function. Functions are bundled with esbuild. They import from `shared/` at the
repo root, which is what keeps the production auth/validation identical to the
Express server's.

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
| `/api/analytics` | `analytics` | Public, game-event batches only, rate-limited |
| `/api/profile` | `profile` | **Verified Google user**, writes rate-limited |
| `/api/avatar/*` | `avatar` | Public, current selected avatar only |
| `/api/editor/statistics` | `editor-statistics` | **Admin only** |
| `/api/editor/analytics` | `editor-analytics` | **Admin only** |
| `/api/editor/admins` | `editor-admins` | **Admin only** (any verified user may add themselves as the first managed admin when the effective allowlist is empty — see AGENTS.md "Editor auth policy") |
| `/api/editor/profiles` | `editor-profiles` | **Admin only**, public-profile moderation |
| `/api/editor/rankings` | `editor-rankings` | **Admin only**, destructive ranking resets |
| `/api/editor/scenarios` | `editor-scenarios` | **Admin only, including GET** |
| `/api/editor/scenarios/*` | `editor-scenarios` | **Admin only** |
| `/api/editor/series/default` | `editor-series` | **Admin only** |
| `/api/editor/publish` | `editor-publish` | **Admin only** (legacy no-op) |
| `/api/scenarios` | `scenarios` | Public (enabled saved state only) |
| `/*` | SPA fallback | — |

`/api/progress` returns every scenario board plus the series board in one
response. The home screen used to fire one request per scenario *and* run the
whole fan-out twice per visit (the scenario array identity changes when the
runtime fetch resolves), which was 12 function invocations for five puzzles.

## Headers

`netlify.toml` sets a CSP allowing only what the app actually loads, plus
`X-Frame-Options: DENY`, `nosniff`, a `Referrer-Policy`, and a `Permissions-Policy`.
The CSP matters here specifically because the Google ID token is cached in
`localStorage`; a strict `connect-src` leaves an injected script nowhere to send it.

Third-party origins on the allowlist, and the one thing each is for:

| Origin | Directive | Serves |
|---|---|---|
| `accounts.google.com/gsi/client` | `script-src` | Google Identity Services |
| `accounts.google.com` | `connect-src`, `frame-src` | its token endpoints and iframe |
| `lh3.googleusercontent.com`, `*.googleusercontent.com` | `img-src` | Google avatars on the leaderboards |
| `www.googletagmanager.com` | `script-src`, `connect-src` | the GA4 `gtag.js` loader |
| `www.google-analytics.com`, `*.google-analytics.com` | `img-src`, `connect-src` | GA4 collection |
| `*.analytics.google.com` | `connect-src` | GA4 regional collection |

Nothing else is permitted. Keep this table and `netlify.toml` in step — the
allowlist being *broader* than its documentation is the failure this section has
had before: a reviewer asking "should `googletagmanager.com` be in `script-src`?"
reads the doc, finds no such entry, and either strips a legitimate origin or
trusts the doc and misses the drift.

Hashed assets under `/assets/*` are immutable-cached; `index.html` is `no-cache`
so a deploy is picked up on the next load.

## Analytics (GA4)

Google Analytics 4, measurement ID **`G-WJ2Q968GC8`**. Two script tags in
`client/index.html`: the `gtag.js` loader from `googletagmanager.com`, then
`client/public/gtag-init.js`.

**The init snippet is a file, not an inline script, on purpose.** Inlining it
would force `'unsafe-inline'` into `script-src`, which would defeat the reason
the CSP is tight here at all — see Headers above. `/gtag-init.js` is served from
the same origin, so it needs nothing beyond `'self'`. A future "just inline the
snippet" tidy-up would silently widen the policy; don't.

`gtag-init.js` sets `window['ga-disable-G-WJ2Q968GC8'] = true` on `localhost`
and `127.0.0.1` before the `config` call, so local development doesn't land in
the property's reports. GA reads the flag on every hit, so it has to be set
first — keep it above `gtag('config', …)`.

There is no environment variable: the measurement ID is a literal in both files,
and it is public by nature (it ships in the page source either way).

## First-party game analytics

First-party analytics deliberately does not duplicate GA4. It records only
game-specific puzzle starts, meaningful play, active play time, actions,
completion/drop-off, Tutorial progression, and allowlisted game interactions.
There is no persistent browser id and no visit, referrer, campaign, device,
browser, operating-system, geography, identity, or generic screen-view field.

The production client batches events to `POST /api/analytics`. The function
validates the dependency-free shared schema and reduces each random game session
into a bounded summary in the `analytics-sessions` Blobs store. Retried batch ids
are idempotent. `analytics-maintenance.js` runs daily, refreshes anonymous daily
game rollups, and deletes session summaries after 13 calendar months only after
their rollup exists. `GET /api/editor/analytics` is admin-gated and returns
aggregates only; it never returns session or attempt ids.

## Environment Variables

Required for Google login:

- `VITE_GOOGLE_CLIENT_ID` (build) — client-side Sign-In
- `GOOGLE_CLIENT_ID` (functions) — server-side token verification

Required for Netlify Blobs (leaderboards + editor drafts):

- `NETLIFY_SITE_ID` or `SITE_ID`
- `NETLIFY_TOKEN` or `NETLIFY_AUTH_TOKEN`

Required to gate the puzzle editor:

- `ADMIN_EMAILS` (functions) — optional comma-separated deployment
  administrators; combined with the permanent owner and Managed Administrators
- `EDITOR_ALLOW_UNAUTHENTICATED=false` (functions) — fail closed if an
  environment ever has no effective administrator list

Required for player-created GitHub issues:

- `GITHUB_ISSUES_TOKEN` — fine-grained token scoped to `HandsUpBilly/BBT` with
  **Issues: Read and write**. Configure as a Netlify secret; never expose it as
  a `VITE_` variable.

Google OAuth must include the deployed Netlify origin in its authorized
JavaScript origins.

### Editor access is server-authoritative

`netlify/functions/auth.js` and `server/auth.js` combine the permanent project
owner with `ADMIN_EMAILS` whenever Google token verification is configured,
then merge the runtime Managed Administrators list. Every `/api/editor/*` route
requires a verified matching Google user. `/api/editor/access` applies that
same check and returns only a boolean capability used to reveal Puzzle Creator
navigation; the browser never receives the list itself. Set
`EDITOR_ALLOW_UNAUTHENTICATED=false` to return 503 if an environment ever has
no effective allowlist.

**Production should set it.** The permanent owner normally guarantees a
non-empty effective list wherever Google token verification is configured.
`EDITOR_ALLOW_UNAUTHENTICATED=false` remains defence in depth for a restored or
misconfigured environment where verification and every administrator source
are absent; it makes that state a 503. The open default stays available for
local development without OAuth configuration.

The one visible signal is a cold-start `console.warn` from `createGoogleAuth`
when the allowlist is empty *and* access is still open. It shows up in the
function logs; `shared/googleAuth.test.js` covers it so it can't be dropped
quietly.

This variable **cannot be set in `netlify.toml`.** Variables declared in the
config file are scoped to Builds and Post processing, so a function never sees
them at runtime — set it in the Netlify UI (Site configuration → Environment
variables), or:

```bash
netlify env:set EDITOR_ALLOW_UNAUTHENTICATED false --context production
```

## Blobs Concurrency

`netlify/functions/blobEntries.js` wraps leaderboard reads/writes with
`getWithMetadata` + `onlyIfMatch`, retrying on a conflicting etag. Blobs has no
transactions, so a plain read-modify-write silently lost one of two concurrent
submissions. The final retry writes unconditionally so a store whose etag can
never be read still converges instead of rejecting every submission forever.

Blobs is also not immediately read-consistent after a write — that is handled
client-side by the delayed refetch in `App.tsx`.

`netlify/functions/editorStore.js` used to self-heal a Blobs `scenarios`/
`series-default` key that was first seeded before Scenario 006 existed, by
matching stored entries against the placeholder name/description every admin
editor draft starts with (`repairScenario006Placeholder`/
`repairScenario006Series`). That match was too loose: a brand-new, unrelated
puzzle saved without being renamed from "New Puzzle" matched the same check and
had its real content silently overwritten by the Scenario 006 seed on the next
read — an unconditional write from a read path, with no undo. Production was
already repaired by the time this was caught, so the migration was deleted
outright rather than tightened. Don't reintroduce a read-path repair that
writes unconditionally; if a Blobs snapshot needs a one-off fix, do it as an
explicit, single-run operation, not a check that fires on every read
indefinitely.

## Current Production Capabilities

- Static game frontend
- Google Analytics 4 (`G-WJ2Q968GC8`), disabled on localhost
- Google/guest identity
- Individual + series leaderboards, with server-side score validation
- Cross-device public avatars and country/nationality labels for verified users,
  with avatar moderation in Admin Console
- Admin-only complete, per-series, and per-puzzle ranking resets
- Combined home-screen progress endpoint
- Player issue and feature reporting via `/api/reports`, rate-limited
- Admin-only anonymous player-performance statistics from the full retained
  personal-best leaderboards
- Admin-only game engagement, completion/drop-off, Tutorial, action, and active
  play-time graphs from first-party game-session summaries
- **Persistent live puzzle-editor saves** via Netlify Blobs; enabled flags
  control player visibility without a separate publish step
