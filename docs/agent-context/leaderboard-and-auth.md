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
- The identity gate mounts Google Identity Services' rendered click-to-sign-in
  button. Do not replace it with a One Tap-only custom button: One Tap may be
  silently suppressed by browser privacy settings or Google's cooldown, which
  leaves a deliberate click looking like a no-op.
- The client keeps only the Google subject ID and verified e-mail (the latter
  only for the server-side admin allowlist). It does not cache/display Google
  profile names or avatars.
- Server verifies ID tokens with `google-auth-library` via
  `shared/googleAuth.js`, and only trusts `email_verified` addresses.
- Cached auth session uses localStorage key `bbt.auth.v1`.
- A signed-in player must choose a public alias, stored per Google subject in
  `bbt.googleAliases.v1`. That alias is used for leaderboards and reports.

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

- Guest aliases persist via `bbt.guestName.v1` (the key is retained for
  compatibility).
- `IdentityGate` in `App.tsx` blocks UI until a player chooses an alias.

## Admin Access

- Empty or unset `ADMIN_EMAILS` means Puzzle Creator is unrestricted; the matching
  empty `VITE_ADMIN_EMAILS` makes the tab visible to everyone.
- A non-empty `ADMIN_EMAILS` requires a verified Google account whose email is
  listed. Guests cannot satisfy a configured allowlist.
- `EDITOR_ALLOW_UNAUTHENTICATED=false` opts a deployment into returning 503
  when the allowlist is empty.
- The Admin Console can add/remove a persistent managed allowlist. It is merged
  with immutable `ADMIN_EMAILS` deployment administrators and checked on every
  editor request. Runtime management requires a verified Google email even in
  legacy unrestricted local mode.

## Issue and Feature Report Identity

`POST /api/reports` accepts reports from either identified session type. A
Google ID token is verified with the existing `verifyOptionalGoogleUser` path,
but reports use the supplied public alias rather than a Google profile name.
Neither report payloads nor generated GitHub issues include Google IDs,
e-mail addresses, or tokens.

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

Backend helper `entryAuthFields()` adds these from verified Google tokens. The
public `name` field is always the player-chosen alias.

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

Individual puzzle entries may also carry `playLog`, the display-only source for
the completed-play diagram shown after clicking a ranking row. It is separate
from `moves`: free movement belongs in the picture but does not count as a die
roll or participate in the probability product. `scoreValidation.js` still
treats it as untrusted input, caps it at 250 entries, accepts only known action
kinds, bounds coordinates to the 26×15 pitch, and projects every entry down to
the names/positions/block fields `PlayDiagram` actually reads. Older entries
without `playLog` remain valid and render an unavailable message.

Both leaderboard POST routes (`/api/leaderboard/:scenarioId` and
`/api/series-leaderboard`, in both `server/index.js` and the Netlify
functions) are rate-limited with the same `shared/rateLimit.js` limiter used
by `/api/reports`.

**The bucket key is `rateLimitKey`, in `shared/rateLimit.js`.** It answers
"which caller is this" for all five call sites — three Netlify functions and
three Express routes — and it used to be four hand-copied definitions that had
already drifted in form (`req.ip` on Express, parsed forwarding headers on
Netlify). It is a security control, so a tightening applied to one copy and not
the others would leave the other endpoints bypassable while reading as fixed.

It keys on the verified user id when there is one, so a shared IP doesn't
penalise everyone behind it and a signed-in player can't dodge the limit by
changing network. Otherwise it keys on a *trusted* address only:

| Target | Trusted address | Why not a header adapter |
|---|---|---|
| Netlify | `x-nf-client-connection-ip` | set by the edge, always present |
| Express | `req.ip` | not a header at all; respects `trust proxy` |

`x-forwarded-for` is deliberately not consulted. It is client-supplied, so an
attacker rotating it would get a fresh bucket per request — strictly worse than
the shared `'unknown'` fallback, which at least throttles. Neither target should
ever reach that fallback.

**Be precise about what this is not.** It does not distinguish a forged clean
run from a real one — `{probability: 1, diceCount: 0, moves: []}` is accepted,
because walking to the end zone with no rolls is a legitimate 100% solution on
some scenarios. Nor does it detect an internally consistent but fabricated move
list. Only replaying the moves through the rules engine would; see spec.md
"Leaderboard and Report Integrity".

## Attempt History Is Local, And Not The Leaderboard

`client/src/attemptStore.ts` keeps every completed run per puzzle in
`localStorage` under `bbt.attempts.v1` (oldest first, capped at 50 per puzzle);
`AttemptHistory.tsx` renders it under the per-puzzle rankings with an SVG
improvement chart.

It exists precisely *because* the board stores personal bests only. The two
answer different questions and must not be merged: `upsertPersonalBest` throws
away the runs that led up to a best, which is right for a ranking table and is
exactly the data "am I improving?" needs.

Two things to keep true:

- **A run is recorded on reaching the `touchdown` phase, not on submit.** Runs
  the player declines to submit are the ones the board can never show.
- **Nothing goes to the server.** Writing every bad attempt against a player's
  identity would need storage, a retention policy, and a guest story — guests
  are keyed by a self-chosen name, so a shared name would be a shared history.
  See spec.md "Per-Puzzle Attempt History" for what a server-side version would
  have to reuse.

## Storage Rules

- **The store keeps every entry; only reads truncate** (10 on Netlify, 20
  locally). Trimming the stored array deleted a player's personal best the
  moment they dropped out of the visible table, which then broke both the
  by-userId upsert and the home screen's "Best / Rank" display.
- **`upsertPersonalBest` never lets a worse run replace a better one.** Equal
  probability with fewer dice counts as better.
- Signed-in players are matched by `userId`; guests by `name`. This is why the
  Settings screen (`client/src/SettingsScreen.tsx`) confirms before a guest
  rename but not a signed-in one — the guest's next submission is a new player
  as far as `upsertPersonalBest` is concerned, and their old best is stranded
  under the old name. See "Settings Screen and Player Prefs" in
  `frontend-flow.md`.

## Player Prefs (Avatar, Token Style)

`client/src/prefs.ts` stores avatar and player-token-style preferences in
`bbt.prefs.v1`, keyed by identity the same way `bbt.googleAliases.v1` is.
Unlike everything else on this page, it is **entirely local and Phase 1
only** — no server component, no endpoint, nothing sent anywhere. The avatar
is visible only in the browser that uploaded it, never on a leaderboard. A
server-backed, publicly-visible version is spec.md "Player Config Screen"'s
Phase 2 and would need its own verified-identity and rate-limiting story akin
to the report/leaderboard endpoints above — do not assume the local avatar
data URL can simply be forwarded as-is; it is deliberately never sent over the
network today.

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
