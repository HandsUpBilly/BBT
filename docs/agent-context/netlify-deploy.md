# Netlify Deploy

Primary files:

- `netlify.toml`
- `netlify/functions/auth.js`
- `netlify/functions/leaderboard.js`
- `netlify/functions/series-leaderboard.js`
- `netlify/functions/package.json`

## Build

`netlify.toml` uses:

```toml
[build]
  base = "client"
  command = "npm install && npm run build && cd ../netlify/functions && npm install"
  publish = "dist"
```

Functions live at:

```txt
netlify/functions/
```

## Redirects

Current API redirects:

- `/api/leaderboard/*` -> leaderboard function
- `/api/series-leaderboard` -> series leaderboard function
- `/*` -> SPA fallback

If adding production editor APIs, add new redirects for `/api/editor/*`.

## Environment Variables

Required for Google login:

- `VITE_GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_ID`

Required for Netlify Blobs leaderboard storage:

- `NETLIFY_SITE_ID` or `SITE_ID`
- `NETLIFY_TOKEN` or `NETLIFY_AUTH_TOKEN`

Google OAuth must include the deployed Netlify origin.

## Current Production Capabilities

Production supports:

- static game frontend,
- Google/guest identity,
- individual leaderboard,
- series leaderboard.

Production does not yet support persistent puzzle-editor saves.

## Production Editor Path

To support live production editing:

- add protected Netlify functions for scenarios and series,
- verify Google ID token,
- check admin allowlist by Google `sub`,
- store JSON in Netlify Blobs or a database,
- make public scenario loading read from that production store.

