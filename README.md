# Turn 16

A browser-based Blood Bowl puzzle game built around the pressure of the final
turn: move your ball carrier through Orc pressure, make the do-or-die play, and
chase the highest touchdown probability on the leaderboard.

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
- Redirects routing `/api/leaderboard/*`, `/api/series-leaderboard`,
  `/api/editor/*`, and `/api/scenarios` to their respective functions,
  with an SPA fallback for everything else.

### Environment variables

Set these in Netlify's UI under **Site configuration → Environment variables**:

| Variable | Scope | Purpose |
|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Build | Client-side Google Sign-In, baked into the Vite bundle |
| `GOOGLE_CLIENT_ID` | Functions | Server-side verification of Google ID tokens (`netlify/functions/auth.js`) |
| `NETLIFY_SITE_ID` (or `SITE_ID`) | Functions | Netlify Blobs site scoping |
| `NETLIFY_TOKEN` (or `NETLIFY_AUTH_TOKEN`) | Functions | Netlify Blobs auth |
| `ADMIN_EMAILS` | Functions | Comma-separated Google account emails allowed to write via `/api/editor/*` (see below). Unset = no restriction. |
| `VITE_ADMIN_EMAILS` | Build | Same list, baked into the client bundle to control whether the "Admin Mode" button is shown. Keep in sync with `ADMIN_EMAILS`. |

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
series) writes to **Netlify Blobs**, since Netlify Functions have no
persistent filesystem — unlike local dev, where the editor writes
straight to `client/src/scenarios/*.json` via `server/editor.js`.

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

If you'd rather commit puzzles to the repo (e.g. to keep the static
fallback current, or avoid depending on Blobs), fetch the draft/published
JSON directly and copy it into the scenario files by hand:

```bash
curl https://<your-site>.netlify.app/api/scenarios
```

**Access control**: write endpoints (`/api/editor/*`) require a signed-in
Google user whose email is in the `ADMIN_EMAILS` env var (comma-separated).
The "Admin Mode" button is hidden client-side for non-allowlisted users
(`VITE_ADMIN_EMAILS`), but that's a UX nicety, not the security boundary —
the server-side `ADMIN_EMAILS` check is what actually blocks writes.
`GET /api/scenarios` (what players' clients fetch) is intentionally public
and unauthenticated.

If neither `ADMIN_EMAILS` nor `VITE_ADMIN_EMAILS` is set, the editor is
open to everyone (matches the previous unrestricted behavior) — this is
also why local dev works without any Google OAuth setup.
