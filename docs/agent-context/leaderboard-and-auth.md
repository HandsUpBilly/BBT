# Leaderboard And Auth

Primary files:

- `client/src/AuthProvider.tsx`, `client/src/auth.ts`
- `client/src/api.ts`, `client/src/SubmitModal.tsx`
- `client/src/UserMenu.tsx`
- `shared/googleAuth.js`, `shared/scoreValidation.js`
- `server/auth.js`, `server/index.js`
- `netlify/functions/{auth,leaderboard,series-leaderboard,progress,blobEntries}.js`

## Identity

The app uses Google Identity Services plus guest names.

Google flow:

- `AuthProvider.tsx` loads `https://accounts.google.com/gsi/client`.
- Client decodes the JWT payload for display only (`decodeJwtPayload` in
  `auth.ts`). It decodes as UTF-8, not latin1 — `atob` alone mangles any
  non-ASCII display name.
- Server verifies ID tokens with `google-auth-library` via
  `shared/googleAuth.js`, and only trusts `email_verified` addresses.
- Cached auth session uses localStorage key `bbt.auth.v1`.

### Token expiry

Google ID tokens last about an hour. The cached token used to be sent forever,
so a tab left open long enough started 401-ing on every submission — invisibly,
because the failure was swallowed. Now:

- `isTokenExpired(token)` checks `exp` with a 60s skew allowance, and treats
  anything not shaped like a JWT as expired.
- An expired token is never sent (`idToken` reads as `null`).
- The cached *user* is kept, so the identity gate doesn't bounce the player back
  to the login screen.
- `sessionExpired` drives a "sign in again" banner in `App.tsx`.

Guest flow:

- Guest name persists via `bbt.guestName.v1`.
- `IdentityGate` in `App.tsx` blocks UI until a Google user or guest name exists.

## Admin Access

- Empty or unset `ADMIN_EMAILS` means Admin Mode is unrestricted; the matching
  empty `VITE_ADMIN_EMAILS` makes the tab visible to everyone.
- A non-empty `ADMIN_EMAILS` requires a verified Google account whose email is
  listed. Guests cannot satisfy a configured allowlist.
- `EDITOR_ALLOW_UNAUTHENTICATED=false` opts a deployment into returning 503
  when the allowlist is empty.

## Issue and Feature Report Identity

`POST /api/reports` accepts reports from either identified session type. A
Google ID token is verified with the existing `verifyOptionalGoogleUser` path;
the server uses its verified display name rather than the browser-supplied
reporter name. Guest reports require a non-empty reporter name. Neither report
payloads nor generated GitHub issues include Google IDs, e-mail addresses, or
tokens.

A Bearer token that fails verification (most commonly: expired after the tab
sat idle — see "Token expiry" above) does **not** reject the report. The
report form always collects a reporter name regardless of sign-in state, so
both server targets catch that `AuthError` and degrade to the guest path
(`user = null`) rather than surfacing "Invalid Google identity token" for a
flow that doesn't need a verified identity. This is a deliberate exception:
leaderboard and series-leaderboard submissions still reject an unverifiable
token outright, since attribution there is tied to score integrity.

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
4. Wait `LEADERBOARD_CONSISTENCY_DELAY_MS` (3000ms).
5. Refetch entries into `initialEntries`.
6. Bump the leaderboard `refreshKey`.

Use this for new leaderboard-writing flows.

Concurrent writes are handled separately, by etag retries in
`netlify/functions/blobEntries.js` — see `netlify-deploy.md`.

## Score Integrity

The client computes the probability, so submissions are **validated, not
trusted**. `shared/scoreValidation.js` (used by both targets):

- bounds `probability` to `(0, 1]` and `diceCount` to a small integer, keeping
  NaN/Infinity/negatives out of the sort key — those would corrupt the ordering
  for everyone, not just the submitter;
- requires `diceCount` to equal the number of submitted moves;
- checks the claimed probability against the *product* of the submitted
  per-action probabilities, so a tamperer can't just raise the number on an
  otherwise real run;
- projects each move down to a fixed whitelist of fields (`sanitizeMove`,
  matching `RiskyMove` in `client/src/types.ts`) with length-capped strings and
  enum-checked faces/bands/pickers — a submitted move cannot carry arbitrary
  extra properties or oversized strings into the stored Blob;
- for series, requires the average and dice total to match the puzzle results.

Both leaderboard POST routes (`/api/leaderboard/:scenarioId` and
`/api/series-leaderboard`, in both `server/index.js` and the Netlify
functions) are rate-limited with the same `shared/rateLimit.js` limiter used
by `/api/reports`, keyed on the verified user id or client IP.

**Be precise about what this is not.** It does not distinguish a forged clean
run from a real one — `{probability: 1, diceCount: 0, moves: []}` is accepted,
because walking to the end zone with no rolls is a legitimate 100% solution on
some scenarios. Nor does it detect an internally consistent but fabricated move
list. Only replaying the moves through the rules engine would; see spec.md
"Leaderboard and Report Integrity".

## Storage Rules

- **The store keeps every entry; only reads truncate** (10 on Netlify, 20
  locally). Trimming the stored array deleted a player's personal best the
  moment they dropped out of the visible table, which then broke both the
  by-userId upsert and the home screen's "Best / Rank" display.
- **`upsertPersonalBest` never lets a worse run replace a better one.** Equal
  probability with fewer dice counts as better.
- Signed-in players are matched by `userId`; guests by `name`.

## Home-Screen Progress

`GET /api/progress` returns every scenario board plus the series board in one
response. `App.tsx` fetches it and passes it down to `ScenarioSelect` as a prop.
Fetching inside `ScenarioSelect` meant one request per scenario, re-run whenever
the scenario array identity changed.

## Error Surfacing

Submit failures used to be swallowed by a bare `catch`, so a failed submission
looked identical to a success with a missing score. `api.ts` now throws a typed
`ApiError` carrying the HTTP status, `describeSubmitError` turns it into
something a player can act on, and `SubmitModal` keeps the dialog open with a
retry button.

## Local vs Production

Local:

- Express API in `server/index.js`.
- In-memory leaderboards.
- Google token verification if `GOOGLE_CLIENT_ID` is set.

Production:

- Netlify Functions.
- Netlify Blobs for leaderboard storage.
- Requires Netlify env vars for Blobs and Google auth.
