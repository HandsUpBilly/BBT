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
  `/api/progress`, `/api/reports`, `/api/editor/*`, and `/api/scenarios` to
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
| `NETLIFY_SITE_ID` (or `SITE_ID`) | Functions | Netlify Blobs site scoping |
| `NETLIFY_TOKEN` (or `NETLIFY_AUTH_TOKEN`) | Functions | Netlify Blobs auth |
| `ADMIN_EMAILS` | Functions | Comma-separated Google account emails allowed to use `/api/editor/*` (see below). **Unset = unrestricted Admin Mode.** |
| `VITE_ADMIN_EMAILS` | Build | Same list, baked into the client bundle to control whether the Admin Mode tab is shown. Unset shows it to everyone. Keep in sync with `ADMIN_EMAILS`. |
| `GITHUB_ISSUES_TOKEN` | Functions | Fine-grained token limited to `HandsUpBilly/BBT` with **Issues: Read and write**, for player-submitted reports. Server-only — never a `VITE_` variable. |
| `EDITOR_ALLOW_UNAUTHENTICATED` | Functions | Set to `false` to make an empty `ADMIN_EMAILS` fail closed with 503. Defaults to unrestricted. **Production should set this** — see below. |

`EDITOR_ALLOW_UNAUTHENTICATED=false` is worth setting on the production site.
Left unset, the only thing protecting every `/api/editor/*` route — unpublished
drafts, anonymous write/delete/publish, and the retained leaderboard aggregates
— is `ADMIN_EMAILS` being non-empty here. Clear it or typo it and the whole
surface opens to anonymous callers, silently. The functions log a warning at
cold start in that state, but nothing else surfaces it.

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

### Deploy

Push to `main` (or trigger a deploy from the Netlify UI). After the
deploy finishes, confirm:

- The game loads and puzzles are playable.
- Guest login and Google Sign-In both work.
- Submitting a score updates the individual and series leaderboards.

### Puzzle Editor on Netlify

Admin Mode has separate **Puzzle Editor** and **Statistics** sections. The
editor (create/edit scenarios, edit the default series) writes to **Netlify
Blobs**, since Netlify Functions have no persistent filesystem — unlike local
dev, where the editor writes straight to `client/src/scenarios/*.json` via
`server/editor.js`.

Blobs holds two states:

- **Draft** — every scenario/series save from the editor
  (`netlify/functions/editor-scenarios.js`, `editor-series.js`) goes
  here. Lets you stage multiple edits without affecting players.
- **Published** — what the live game actually serves to players, via
  the public `GET /api/scenarios` endpoint
  (`netlify/functions/scenarios.js`), fetched at runtime by the client
  (`client/src/scenarios/runtime.ts`). Falls back to the build-time
  static bundle (`client/src/scenarios/*.json`,
  `client/src/series/default.json`) if that fetch fails.

**Publishing**: click **Publish** in the editor toolbar. This calls
`POST /api/editor/publish` (`netlify/functions/editor-publish.js`),
which copies the current draft into the published Blobs keys — no
redeploy required, and it's live for players within a page refresh.

**Statistics**: the admin-only `GET /api/editor/statistics` endpoint reads the
full retained puzzle and series leaderboards and returns anonymous aggregates.
The dashboard reports personal-best counts and probability/dice summaries, not
attempt counts or completion rates; leaderboard storage keeps only one personal
best per player. Player names, ids, and move histories are not returned.

If you'd rather commit puzzles to the repo (e.g. to keep the static
fallback current, or avoid depending on Blobs), fetch the published JSON
directly and copy it into the scenario files by hand:

```bash
curl https://<your-site>.netlify.app/api/scenarios
```

After adding or editing `client/src/scenarios/*.json`, run `npm run build`
(or `npm run generate:seed`) so `netlify/functions/scenarioSeed.js` — the
first-read seed for the Blobs store — is regenerated. It is a generated file;
don't hand-edit it.

**Access control**: when `ADMIN_EMAILS` is non-empty, every `/api/editor/*`
route — including reads of drafts and statistics — requires a signed-in Google
user whose *verified* email is listed. When `ADMIN_EMAILS` is empty or unset,
Admin Mode is unrestricted and the tab is shown to everyone. Set
`EDITOR_ALLOW_UNAUTHENTICATED=false` if a deployment should return 503 instead
when its allowlist is empty.

`VITE_ADMIN_EMAILS` only controls tab visibility and is not a security
boundary. Keep it aligned with `ADMIN_EMAILS` when using an allowlist.
