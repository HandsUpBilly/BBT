# Turn 16

A browser-based Blood Bowl puzzle game built around the pressure of the final
turn: **in a single turn**, move your ball carrier through Orc pressure —
dodging, rushing, blocking, passing, handing off — and make the do-or-die play.
The cumulative probability of every roll your line depends on *is* your score.

```
client/               React + TypeScript + Vite frontend
shared/               Validation, auth, and reporting used by all three targets
server/               Express API — local dev leaderboard + puzzle editor
netlify/functions/    Netlify serverless functions (production)
scripts/              Build-time codegen and one-shot helpers
docs/agent-context/   Durable notes on shipped behavior
spec.md               Feature plans + shipped history, each with a Status line
```

See `AGENTS.md` for local development setup, architecture notes, and coding
conventions.

## Verify

```bash
npm run verify
```

Runs lint, both test suites (`node --test` over `shared/` and `netlify/tests/`,
vitest over `client/`), the production build, and `check:functions`, which
bundles the Netlify functions the way the deploy does.

The Playwright layout harness is separate — it needs browser binaries `npm
install` does not fetch. See `AGENTS.md`.

## Deploying to Netlify

### Prerequisites

- A GitHub repo connected to Netlify (`HandsUpBilly/BBT`).
- A [Google OAuth Client ID](https://console.cloud.google.com/apis/credentials)
  for Google Sign-In.
- A Netlify [personal access token](https://docs.netlify.com/api/get-started/#authentication)
  with Blobs read/write access (used by leaderboard + editor functions).

### Site configuration

Netlify picks up `netlify.toml` at the repo root automatically — no
manual build settings are required beyond connecting the repo. It
configures:

- `base = "client"`, a build command that regenerates the scenario seed before
  building, and `publish = "dist"`
- `functions = "../netlify/functions"` (bundled with esbuild)
- Redirects routing `/api/leaderboard/*`, `/api/series-leaderboard`,
  `/api/profile`, `/api/avatar/*`, `/api/progress`, `/api/reports`,
  `/api/editor/*`, and `/api/scenarios` to
  their respective functions, with an SPA fallback for everything else
- Security headers, including a CSP scoped to the Google Identity Services
  script and its endpoints, Google avatar images, and the Google Analytics tag
  and its collection endpoints — nothing else may be loaded or contacted. The
  full origin-by-origin table is in `docs/agent-context/netlify-deploy.md`.

### Analytics

Google Analytics 4 (`G-WJ2Q968GC8`) loads from `client/index.html`, with its
init snippet in `client/public/gtag-init.js` rather than inline so the CSP needs
no `'unsafe-inline'`. It is disabled on `localhost` and `127.0.0.1`. No
environment variable is involved.

### Environment variables

Set these in Netlify's UI under **Site configuration → Environment variables**:

| Variable | Scope | Purpose |
|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Build | Client-side Google Sign-In, baked into the Vite bundle |
| `GOOGLE_CLIENT_ID` | Functions | Server-side verification of Google ID tokens (`netlify/functions/auth.js`) |
| `AUTH_SESSION_SECRET` | Functions | At least 32 random characters used to sign Turn 16 sessions and Discord OAuth state. Keep stable and secret. |
| `AUTH_APP_URL` | Functions | Public site origin used after email/Discord login, e.g. `https://turn-16.com` (no path). |
| `DISCORD_CLIENT_ID` | Functions | Discord application client ID. |
| `DISCORD_CLIENT_SECRET` | Functions | Discord application secret. Server-only. |
| `DISCORD_REDIRECT_URI` | Functions | Exact registered callback URL, e.g. `https://turn-16.com/api/auth/discord/callback`. |
| `NETLIFY_SITE_ID` (or `SITE_ID`) | Functions | Netlify Blobs site scoping |
| `NETLIFY_TOKEN` (or `NETLIFY_AUTH_TOKEN`) | Functions | Netlify Blobs auth |
| `ADMIN_EMAILS` | Functions | Optional comma-separated deployment administrators, combined with the permanent owner and Managed Administrators for `/api/editor/*` access |
| `GITHUB_ISSUES_TOKEN` | Functions | Fine-grained token limited to `HandsUpBilly/BBT` with **Issues: Read and write**, for player-submitted reports. Server-only — never a `VITE_` variable. |
| `RESEND_API_KEY` | Functions | [Resend](https://resend.com) API key used to send Contact form messages. Server-only — never a `VITE_` variable. |
| `CONTACT_EMAIL_TO` | Functions | The real inbox a contact message is delivered to. Server-only; never appears in the client bundle. |
| `CONTACT_EMAIL_FROM` | Functions | The verified sending address (e.g. `contact@turn-16.com`) — the domain must be verified with Resend (SPF/DKIM records added at your DNS host). |
| `AUTH_EMAIL_FROM` | Functions | Optional verified sender for login emails. Falls back to `CONTACT_EMAIL_FROM`. |
| `EDITOR_ALLOW_UNAUTHENTICATED` | Functions | Set to `false` to make an empty effective administrator list fail closed with 503. Defaults to unrestricted. **Production should set this** — see below. |

`EDITOR_ALLOW_UNAUTHENTICATED=false` is worth setting on the production site.
The permanent owner normally guarantees a non-empty list wherever Google token
verification is configured; fail-closed remains defence in depth for a broken
or incomplete environment. Without it, an environment that has neither Google
verification nor any configured or managed administrator can still inherit the
legacy unrestricted-editor behavior.

It must be set in the UI (or `netlify env:set EDITOR_ALLOW_UNAUTHENTICATED false
--context production`) — **not** in `netlify.toml`, whose variables are scoped
to builds and never reach a function at runtime.

### Google Cloud OAuth config

In the Google Cloud Console, add the deployed Netlify origin(s) to the
OAuth Client's **Authorized JavaScript origins**:

```
https://<your-site-name>.netlify.app
```

Add any custom domain the same way.

### Discord and email login config

Create a Discord application in the Developer Portal and add the exact
`DISCORD_REDIRECT_URI` under **OAuth2 → Redirects**. Turn 16 requests only the
`identify` and `email` scopes. Discord and email login stay hidden until all
variables required for that provider are present.

Generate `AUTH_SESSION_SECRET` once, keep it stable, and scope `AUTH_APP_URL`
and `DISCORD_REDIRECT_URI` to each deployed environment. Login emails use the
existing Resend account and verified domain; `AUTH_EMAIL_FROM` may be something
like `Turn 16 <login@contact.turn-16.com>`.

### Deploy

Push to `main` (or trigger a deploy from the Netlify UI). After the
deploy finishes, confirm:

- The game loads and puzzles are playable.
- Guest login and Google Sign-In both work.
- Submitting a score updates the individual and series leaderboards.
- A signed-in player can upload or select a Google avatar and save an optional
  country/nationality; both appear on rankings after refresh.

### Puzzle Editor on Netlify

Admin Mode has separate **Puzzle Editor** and **Statistics** sections. On
Netlify, the editor stores versioned content in the `editor-drafts` Blobs store;
local Express development still writes directly to
`client/src/scenarios/*.json` and `client/src/series/*.json`.

The production catalogue (`content-v3/catalog`) keeps **saved editor drafts**
and **published snapshots** separately. The original legacy Blob keys remain
untouched as migration backups. Branch deployments and deploy previews use
isolated content keys.

- **Save Draft** stores an editable puzzle or series revision without changing
  the public game. It is guarded by a per-item revision and atomic ETag checks,
  preventing stale tabs from overwriting newer work.
- **Publish Draft** (or **Unpublish Draft**) promotes that exact saved revision
  into the public snapshot, with an independent published-revision check. A
  published series can only reference published puzzles. No redeploy is needed.
- **Delete** is intentionally destructive: after confirmation, a deleted item is
  removed from public play and puzzle membership references are updated. Player
  scores and profiles are not reset.
- The public `GET /api/scenarios` and `GET /api/progress` endpoints read the
  published snapshot, not pending editor changes. The browser can fall back
  to the bundled scenario JSON if runtime loading fails.

`POST /api/editor/content-publish` is the revision-checked publishing API.
The legacy `POST /api/editor/publish` endpoint is a compatibility no-op for
older cached clients; it **does not publish**. Use the editor's explicit
Publish Draft action instead.

**GitHub synchronisation**: the checked-in JSON is a versioned deployment
baseline. New deploys reconcile GitHub updates with live edits using three-way
field-level merges; conflicting changes remain visible and keep the live value
until reviewed. **Review Live Changes in GitHub** shows a read-only preview and
requires explicit selection of individual puzzle or series files, then opens a
reviewable PR against `staging`. It never automatically merges, publishes or
copies unrelated unpublished drafts. The server-side GitHub credential must be
configured as `GITHUB_CONTENT_SYNC_TOKEN` in Netlify Functions. See
`docs/agent-context/content-sync.md` and issue #376 for verification and
deployment requirements.

**Statistics**: the admin-only `GET /api/editor/statistics` endpoint reads the
full retained puzzle and series leaderboards and returns anonymous aggregates.
The dashboard reports personal-best counts and probability/dice summaries, not
attempt counts or completion rates; leaderboard storage keeps only one personal
best per player. Player names, ids, and move histories are not returned.

**Ranking resets**: Admin Console can clear all retained rankings, one series,
or one individual puzzle. Each action is confirmed and affects leaderboard
personal bests only—profiles, logins, analytics, drafts, and players' local
attempt history remain intact.

For an independent backup, the public published catalogue can still be
retrieved using:

```bash
curl https://<your-site>.netlify.app/api/scenarios
```

For new repository-authored puzzles and series, edit the corresponding
JSON in `client/src/scenarios/` and `client/src/series/`; the Netlify build
regenerates `netlify/functions/scenarioSeed.js` via `npm run generate:seed`.
This is generated content and must not be edited directly.

**Access control**: every `/api/editor/*` route — including reads of drafts and
statistics — checks the permanent owner, `ADMIN_EMAILS`, and the runtime Managed
Administrators list against Google's verified email claim. The client calls the
protected `/api/editor/access` capability endpoint and keeps Puzzle Creator
navigation hidden unless that same server check succeeds; administrator emails
are never baked into or returned to the browser. Set
`EDITOR_ALLOW_UNAUTHENTICATED=false` so a deployment with no effective
allowlist fails closed.
