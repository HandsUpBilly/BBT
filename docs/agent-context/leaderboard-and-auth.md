# Leaderboard And Auth

Primary files:

- `client/src/AuthProvider.tsx`
- `client/src/auth.ts`
- `client/src/api.ts`
- `client/src/UserMenu.tsx`
- `server/auth.js`
- `server/index.js`
- `netlify/functions/auth.js`
- `netlify/functions/leaderboard.js`
- `netlify/functions/series-leaderboard.js`

## Identity

The app uses Google Identity Services plus guest names.

Google flow:

- `AuthProvider.tsx` loads `https://accounts.google.com/gsi/client`.
- Client decodes JWT payload for display.
- Server verifies ID tokens with `google-auth-library`.
- Cached auth session uses localStorage key `bbt.auth.v1`.

Guest flow:

- Guest name persists via `bbt.guestName.v1`.
- `IdentityGate` in `App.tsx` blocks UI until a Google user or guest name exists.

## Entry Metadata

`LeaderboardEntry` and `SeriesLeaderboardEntry` can include:

- `userId`
- `authProvider`
- `displayName`
- `avatarUrl`

Backend helper `entryAuthFields()` adds these from verified Google tokens.

## Leaderboard Consistency

Netlify Blobs can be eventually consistent after writes. Follow the established
submit pattern in `App.tsx`:

1. Submit score.
2. Store local score id and set highlight.
3. Switch to leaderboard view.
4. Wait `3000ms`.
5. Refetch entries into `initialEntries`.
6. Bump the leaderboard `refreshKey`.

Use this for new leaderboard-writing flows.

## Local vs Production

Local:

- Express API in `server/index.js`.
- In-memory leaderboards.
- Google token verification if `GOOGLE_CLIENT_ID` is set.

Production:

- Netlify Functions.
- Netlify Blobs for leaderboard storage.
- Requires Netlify env vars for Blobs and Google auth.

