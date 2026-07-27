# Blood Bowl Tactical Puzzle

A browser-based Blood Bowl puzzle game: move your ball carrier through
Orc pressure, dodge and hand off across the pitch, and chase the highest
success probability on the leaderboard.

```
client/               React + TypeScript + Vite frontend
server/               Express API — in-memory leaderboard + local puzzle editor (local dev only)
netlify/functions/    Netlify serverless functions (production) — leaderboards + puzzle editor
```

See `AGENTS.md` for local development setup, architecture notes, and
coding conventions.

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

- `base = "client"`, `command = "npm install && npm run build && cd ../netlify/functions && npm install"`, `publish = "dist"`
- `functions = "../netlify/functions"` (bundled with esbuild)
- Redirects routing `/api/leaderboard/*`, `/api/series-leaderboard`, and
  `/api/editor/*` to their respective functions, with an SPA fallback for
  everything else.

### Environment variables

Set these in Netlify's UI under **Site configuration → Environment variables**:

| Variable | Scope | Purpose |
|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Build | Client-side Google Sign-In, baked into the Vite bundle |
| `GOOGLE_CLIENT_ID` | Functions | Server-side verification of Google ID tokens (`netlify/functions/auth.js`) |
| `NETLIFY_SITE_ID` (or `SITE_ID`) | Functions | Netlify Blobs site scoping |
| `NETLIFY_TOKEN` (or `NETLIFY_AUTH_TOKEN`) | Functions | Netlify Blobs auth |

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

Admin Mode's puzzle editor (create/edit scenarios, edit the default
series) is reachable on the deployed site with **no access
restriction** — anyone with the site URL can open it. This is a known
limitation of the current setup, not a bug; there is no login/allowlist
gating on the editor functions.

Netlify Functions have no persistent filesystem, so unlike local dev
(where the editor writes straight to `client/src/scenarios/*.json` via
`server/editor.js`), the deployed editor saves edits as **drafts in
Netlify Blobs** (`netlify/functions/editor-scenarios.js`,
`editor-series.js`). Draft edits:

- Do **not** affect what players see. The live game always serves
  scenarios from the static bundle built from
  `client/src/scenarios/*.json` and `client/src/series/default.json`.
- Persist across editor sessions (stored in Blobs), but only as drafts.
- Seed themselves from the currently-published static JSON the first
  time the editor is opened after a deploy.

**To publish an edited scenario or series:**

1. Make your changes in the deployed Admin Mode editor.
2. Fetch the current draft JSON directly from the API, e.g.:
   ```bash
   curl https://<your-site>.netlify.app/api/editor/scenarios
   ```
   (or open that URL / the Network tab in browser devtools).
3. Copy each edited scenario object into its corresponding
   `client/src/scenarios/scenario-00N.json` file (or add a new file for
   a new scenario), and copy the `series` object into
   `client/src/series/default.json`, matching the existing formatting.
4. Commit and push. Netlify redeploys and the change goes live.

There is no built-in export/publish button — this is a manual copy-paste
step by design, since automatic publishing would require the live game
to read scenarios from a runtime store instead of the static bundle.
