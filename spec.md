# Blood Bowl Tactical Puzzle — Spec

---

## Issue and Feature Request Reporting

### Goal

Let any player who has passed the existing identity gate report an issue or
request a feature from the game. A report is submitted as a GitHub issue to
`HandsUpBilly/BBT`; if that delivery cannot be completed, the player can
download a ready-to-file Markdown report instead.

### Requirements

- Provide a visible **Report a problem** button on player-facing, non-editor
  screens. It must be available from the home screen and while playing a
  puzzle, without obscuring essential game controls.
- Clicking the button opens an accessible modal dialog that:
  - requires a category: **Issue** or **Feature request**;
  - requires a short title and a description;
  - shows the reporter name prefilled from the current Google display name or
    guest name, and permits the player to correct it before submission;
  - exposes a submit button, cancel control, keyboard Escape dismissal, and
    clear inline validation and request-failure feedback.
- Submit to `POST /api/reports`. The browser sends only `type`, `title`,
  `description`, `reporterName`, and the existing Google ID token when
  available.
- The server must require an identified reporter. For Google sessions, verify
  the token and use the verified display name in preference to the supplied
  name; for guest sessions, require the non-empty supplied name.
- Create a GitHub issue in `HandsUpBilly/BBT` with a title prefixed by
  `[Issue]` or `[Feature]`, and a Markdown body containing the category, reporter
  name, description, submission timestamp, and the application context below.
- Add non-sensitive context automatically: app version/build identifier when
  available, current app mode, current scenario/series identifier and name
  when applicable, and browser user-agent. Do not include access tokens,
  e-mail addresses, Google subject IDs, localStorage values, or game secrets.
- On successful creation, show a success state containing the returned GitHub
  issue number/link and let the player close the dialog.
- If GitHub is unavailable, returns an error, or the server is not configured,
  retain the filled form and offer **Download report**. The downloaded UTF-8
  Markdown must contain the same sanitized issue title and body that would
  have been sent to GitHub, so it can be supplied to Ona or filed manually.
- No report history, administrator reporting screen, file attachment, or
  anonymous submission is in this first release.

### Constraints and Security

- The GitHub credential is server-only. Use a fine-grained token limited to
  the `HandsUpBilly/BBT` repository with **Issues: Read and write** permission,
  supplied as `GITHUB_ISSUES_TOKEN` in local development and Netlify.
- Never ship, log, return, or embed `GITHUB_ISSUES_TOKEN` in the client. A
  missing token must be treated as a configuration failure, not as permission
  to call GitHub from the browser.
- Apply size and content validation before calling GitHub: category enum,
  trimmed reporter name (1–64 characters), title (1–120 characters), and
  description (1–4,000 characters). Reject invalid JSON, overlong fields, and
  methods other than POST with appropriate 4xx responses.
- Treat all report text and client context as untrusted. Render it only as
  escaped Markdown/plain text, and do not use it in server logs beyond a
  concise failure reason.
- Reuse the established optional Google verification path. Invalid supplied
  tokens return 401; a guest report is valid only with a non-empty reporter
  name. Rate limiting is out of scope for this first pass, but the route must
  be isolated so it can be added later.
- Preserve the existing tabletop playbook styling, responsive behavior,
  reduced-motion behavior, identity flow, leaderboards, game rules, and Admin
  Mode isolation.

### Architecture

| Layer | Responsibility |
| --- | --- |
| `client/src/ReportProblemButton.tsx` | Reusable launcher placed in player-facing shells; owns no report state. |
| `client/src/ReportProblemModal.tsx` | Category, title, description, reporter-name form; validation; submitted/error/download states; accessible focus and keyboard behavior. |
| `client/src/api.ts` | Typed `submitReport()` request helper, passing the optional Google ID token. |
| `client/src/App.tsx` | Owns modal visibility and composes app/scenario context plus the current identity name/token. |
| `client/src/PlaybookTheme.css` | Scoped modal and launcher styling consistent with the player-facing theme. |
| `server/index.js` | Local `POST /api/reports` implementation. Verifies optional Google identity, validates the payload, calls GitHub's Issues API, and returns `{ number, url }`. |
| `netlify/functions/reports.js` | Production equivalent using the same validation/body-building behavior and the standard Fetch API. |
| `netlify.toml` | Routes `/api/reports` to the production function before the SPA fallback. |

The backend should centralize report validation and Markdown generation in a
small shared server-side module usable by the Express route and Netlify
function. This prevents the two deployment targets from producing different
issue bodies or security behavior. The GitHub API request is a server-side
`POST https://api.github.com/repos/HandsUpBilly/BBT/issues` with the
repository credential, API version headers, JSON `{ title, body }`, and no
automatic label creation. Category remains visible through the title prefix
and Markdown metadata.

### Implementation Steps

1. Add report input/result/context types and `submitReport()` to the client API
   layer. Define the maximum lengths once and mirror them in the server shared
   validator.
2. Build a shared backend report utility for payload validation, identity-name
   resolution, safe Markdown generation, and GitHub Issues API requests. Add
   focused unit tests for valid input, invalid input, verified-name precedence,
   and Markdown escaping.
3. Register `POST /api/reports` in Express and add the matching Netlify
   `reports.js` function plus `/api/reports` redirect. Return 201 with the
   issue number and URL; distinguish invalid input (400), invalid Google token
   (401), missing server configuration (503), and GitHub/upstream failures
   (502).
4. Add the reusable report launcher and modal. Prefill the name from the
   identity gate, send live context from `App.tsx`, and keep the dialog data on
   any failed request.
5. Implement the client-side Markdown-download fallback using the same visible
   report fields/context. Make it available only after a server delivery
   failure/configuration failure, with a clear instruction that it can be filed
   through Ona or GitHub.
6. Add scoped responsive/focus/reduced-motion styles and verify the dialog on
   home, gameplay, leaderboard, summary, and mobile layouts. Keep it out of
   Admin Mode unless deliberately added later.
7. Document `GITHUB_ISSUES_TOKEN`, its minimum permission, and local/Netlify
   setup in the deployment context. Update the frontend/auth context docs with
   the reporting entry point and data boundaries.

### Success Criteria

- An identified Google or guest player can open the dialog, sees their current
  name prefilled, chooses Issue or Feature request, and cannot submit an incomplete or
  overlong report.
- A valid submit creates exactly one issue in `HandsUpBilly/BBT` with the
  correct category prefix, reporter name, description, and allowed context;
  the UI displays the new issue link.
- A verified Google name cannot be spoofed by editing the browser request.
- A missing/invalid GitHub credential or an upstream error creates no partial
  client success state, retains the report contents, and produces a usable
  Markdown download.
- The token never appears in source, browser bundles, responses, issue bodies,
  or logs.
- The dialog is keyboard-operable, has a visible focus state, behaves at
  320 px+ without horizontal page overflow, and does not regress gameplay or
  Admin Mode.
- `cd client && npm run test`, `cd client && npm run build`, and
  `cd client && npm run lint` pass; backend tests cover the report endpoint's
  validation, identity, GitHub success, and GitHub failure paths.

---

## Handoff Action

### Overview

A ball carrier can hand off the ball to an adjacent teammate at the end of their activation. The receiver must make a Catch roll. Success transfers the ball; failure causes a turnover (no submission).

This counts as the team's **Pass action** — only one handoff per team turn.

---

### Rules

**Eligibility**
- The ball carrier must be selected and have finished (or skipped) their movement.
- The receiver must be in one of the 8 adjacent squares.
- The receiver must not already be activated.
- No handoff has been performed this turn (`passUsed` flag).

**Catch Roll**
- Target = `max(2, min(6, (6 - receiver.ag) - 1 + tzCount))`
  - `6 - receiver.ag` is the base (same as dodge base)
  - `−1` for accurate pass (handoff always counts as accurate)
  - `+1` per opposing tackle zone covering the receiver's square
- Example: AG 3, no TZs → `6 - 3 - 1 = 2+` (5/6 ≈ 83.3%)

**Success**
- Ball transfers to the receiver (`hasBall` flips from carrier to receiver).
- Receiver is **not** marked activated — they can still be selected and moved this turn.
- Carrier is marked activated.

**Failure (in this puzzle context)**
- Catch failure = turnover. No submission. Same treatment as a failed dodge.
- *(Ball bounce/scatter is not simulated — failure simply ends the attempt.)*

**Probability tracking**
- The catch roll probability is logged as an `ActionLogEntry` with `kind: 'handoff'` and multiplied into `cumulativeProb`, exactly like a dodge step.

---

### Data Model Changes

**`types.ts`**

Add `passUsed` to `GameState`:
```ts
passUsed: boolean;  // true once a handoff has been performed this turn
```

Add `kind: 'handoff'` variant to `ActionLogEntry`:
```ts
export type ActionLogEntry =
  | { kind: 'move'; ... }          // existing
  | {
      kind: 'handoff';
      pieceName: string;            // carrier name
      pieceRole: string;
      receiverName: string;
      receiverRole: string;
      from: Position;               // carrier position
      to: Position;                 // receiver position
      catchTarget: number;          // the roll needed (e.g. 2)
      actionProb: number;           // success chance of this roll alone
      cumulativeProb: number;       // running product including this roll
    };
```

Add `passUsed: boolean` to `RiskyMove` is **not** needed — handoff entries are already captured via `ActionLogEntry` and filtered into `moves` by the existing risky-move logic (any entry where `actionProb < 1`).

---

### UI Flow

1. Player selects the ball carrier → moves them (or skips movement by clicking the piece again).
2. After movement is committed (piece is at its destination), the **PieceMenu** gains a **"Hand Off"** action alongside "Move".
   - "Hand Off" is disabled if `passUsed` is true or if no eligible adjacent receiver exists.
3. Player clicks "Hand Off" → game enters `handoff_targeting` phase.
   - Adjacent eligible receivers are highlighted (reachable-style highlight, distinct colour).
   - Clicking a highlighted receiver square executes the handoff.
   - Clicking elsewhere or pressing Escape cancels back to normal.
4. Handoff resolves:
   - Catch target is computed and logged.
   - `hasBall` transfers on the piece objects.
   - `passUsed` is set to `true`.
   - Carrier is marked `activated`.
   - The receiver is **not** activated — player can now select and move them.

---

### Implementation Plan

1. **`types.ts`**: Add `passUsed: boolean` to `GameState`; add `kind: 'handoff'` to `ActionLogEntry`.
2. **`bfs.ts`**: Add `catchTargetAt(receiverPos, receiverAg, opponentPositions)` — same shape as `dodgeTargetAt` but with the `−1` accurate modifier.
3. **`useGameState.ts`**:
   - Add `passUsed: false` to `makeBlankState`.
   - Reset `passUsed` in `advanceTurn` and `clearSelection`.
   - Add `handleHandoffTarget(col, row)` action: finds receiver, computes catch target, logs entry, transfers ball, marks carrier activated, sets `passUsed`.
   - Expose `handoffTargets: Set<string>` in state (adjacent eligible receivers) when in handoff targeting mode.
4. **`GameState`**: Add `handoffTargets: Set<string>` and `isHandoffTargeting: boolean` fields.
5. **`PieceMenu.tsx`**: "Hand Off" action key `'handoff'`; disabled when `passUsed || handoffTargets.size === 0`.
6. **`App.tsx`**: Wire `onAction('handoff')` to enter handoff targeting mode; wire `onSquareClick` to call `handleHandoffTarget` when `isHandoffTargeting`.
7. **`Pitch.tsx`**: Highlight `handoffTargets` squares with a distinct CSS class (`square--handoff-target`).
8. **`Pitch.css`**: Style `square--handoff-target` (e.g. green tint, distinct from reachable blue).
9. **`SubmitModal.tsx` / `ScoreSummary.tsx`**: Handle `kind: 'handoff'` rows — display as "Handoff" in the Type column, receiver name in Player column, catch target as the roll.
10. **`scenario-002.json`**: New scenario using the handoff play (see below).

---

## Pass Action

### Overview

A ball carrier can declare a Pass action, move up to their full MA, then throw to any teammate within range. The pass roll uses the passer's **PA** stat. Only an accurate pass counts — inaccurate and fumble are treated as turnovers (no submission). No interception is modelled.

This shares the `passUsed` flag with handoff — only one pass/handoff per team turn.

---

### PA Stat

Add `pa: number` to `PlayerPiece` and `ScenarioPieceDef`. Standard values by role:

| Role | PA |
|---|---|
| thrower | 3 |
| catcher | 5 |
| lineman | 5 |
| blocker (orc) | 6 |
| blitzer | 5 |

PA represents the target number before modifiers (lower = better, same convention as AG).

---

### Pass Roll (Third Season / BB2025)

**Target = `max(2, min(6, pa + rangePenalty + tzCount))`**

Range is determined with the BB2025 passing range ruler table, matching FFB's `bb2025` implementation. It is not a simple Chebyshev-distance band.

| Band | Range penalty |
|---|---|
| Quick Pass | +0 |
| Short Pass | +1 |
| Long Pass | +2 |
| Long Bomb | +3 |

TZ modifier: +1 per opposing tackle zone covering the **passer's** square.

Natural 1 always fails. Natural 6 always succeeds for players with a PA value, so target values above 6 are represented as 6+ in this puzzle engine.

**Success (accurate pass)**: ball travels to target square, receiver makes a catch roll.

**Failure**: turnover — same treatment as failed dodge (no submission).

---

### Catch Roll (after accurate pass)

Same formula as handoff catch, but the accurate modifier is already baked into the pass roll result — the catch roll for a pass uses:

**Catch target = `max(2, min(6, (6 - receiver.ag) - 1 + tzCount))`**

(identical to handoff catch — +1 accurate modifier, −1 per TZ on receiver)

---

### Pass Range Overlay

When the player enters pass targeting mode, the pitch shows a range overlay:

- All squares in range according to the BB2025 range ruler are coloured by band:
  - Quick: bright yellow tint
  - Short: green tint
  - Long: orange tint
  - Long Bomb: red tint
- Squares occupied by eligible receivers are highlighted with a distinct border
- Hovering a receiver square shows the pass target number and catch target in the HUD status

---

### Probability Tracking

Two rolls are logged for a pass play:

1. **Pass roll** — `kind: 'pass'` log entry, `passTarget` field
2. **Catch roll** — `kind: 'pass-catch'` log entry (or reuse `kind: 'handoff'` with a `passTarget` field)

Both multiply into `cumulativeProb`. The combined probability of a pass play = `P(accurate) × P(catch)`.

---

### Data Model Changes

**`PlayerPiece` and `ScenarioPieceDef`** — add `pa: number`.

**`ActionLogEntry`** — add two new entry types for a pass play:

```ts
// The throw itself — logged when the pass is declared
export type PassLogEntry = {
  kind: 'pass';
  pieceName: string;        // passer
  pieceRole: string;
  receiverName: string;
  receiverRole: string;
  from: Position;           // passer position
  to: Position;             // target square
  passTarget: number;       // pass roll needed (e.g. 3+)
  rangeBand: 'quick' | 'short' | 'long' | 'bomb';
  actionProb: number;       // P(accurate pass roll alone)
  cumulativeProb: number;   // running product after pass roll
  dodgeTarget: null;
  isGfi: false;
};

// The catch — logged immediately after the pass entry
export type PassCatchLogEntry = {
  kind: 'pass-catch';
  pieceName: string;        // receiver
  pieceRole: string;
  from: Position;           // target square (same as pass `to`)
  to: Position;             // same as from (catch is in place)
  catchTarget: number;      // catch roll needed
  actionProb: number;       // P(catch roll alone)
  cumulativeProb: number;   // running product after catch roll
  dodgeTarget: null;
  isGfi: false;
};
```

The two entries are always added together. In the log display, the pass row shows the throw (passer, range, pass target) and the catch row shows the receiver and catch target.

**`GameState`** — add:
```ts
pendingPass: boolean;        // carrier declared pass — move first, then pick target
isPassTargeting: boolean;    // carrier finished moving, now picking a throw target
passRangeKeys: Map<string, 'quick' | 'short' | 'long' | 'bomb'>; // all throwable squares
passReceiverKeys: Set<string>; // subset: squares with eligible receivers
```

**`RiskyMove`** — add optional `passTarget`, `rangeBand`, and `catchTarget` fields. A pass play produces two `RiskyMove` entries: one for the throw (`passTarget`, `rangeBand`) and one for the catch (`catchTarget`).

---

### UI Flow

1. Player right-clicks ball carrier → "Pass" in context menu (disabled if `passUsed`).
2. Carrier is selected for normal movement (`pendingPass: true`). HUD: "Pass declared — move up to N MA, then click piece to throw".
3. Player moves carrier (or skips), clicks carrier to end activation.
4. Game enters pass targeting: pitch shows range overlay, eligible receivers highlighted.
5. Player clicks a receiver → pass executes: pass target computed, catch target computed, both logged, ball transfers, carrier activated.
6. Receiver is **not** activated — can still move this turn.

---

### `bfs.ts` additions

```ts
export type PassRangeBand = 'quick' | 'short' | 'long' | 'bomb'

/** BB2025 range-ruler lookup from passer to target */
export function rangeBandForPass(from: Position, to: Position): PassRangeBand | null

/** BB2025 range penalty for pass roll (+0 quick, +1 short, +2 long, +3 bomb) */
export function rangeModifier(band: PassRangeBand): number

/** Pass target number for passer at passerPos throwing to targetPos */
export function passTargetAt(passerPos: Position, passerPa: number, targetPos: Position, opponentPositions: Position[]): number | null  // null = out of range

/** Compute all throwable squares and their range bands from passerPos */
export function computePassRange(passerPos: Position): Map<string, PassRangeBand>
```

---

### Implementation Plan

1. **`types.ts`**: Add `pa` to `PlayerPiece` and `ScenarioPieceDef`; add `PassLogEntry`; add `pendingPass`, `isPassTargeting`, `passRangeKeys`, `passReceiverKeys` to `GameState`; add `passTarget`/`rangeBand` to `RiskyMove`.
2. **`bfs.ts`**: Add the BB2025 range table, `rangeBandForPass`, `rangeModifier`, `passTargetAt`, `computePassRange`.
3. **`useGameState.ts`**: Add `handlePassAction(pieceId)` (same pattern as `handleHandoffAction`); add `handlePassTarget(col, row)`; intercept end-activation when `pendingPass` to open pass targeting; reset `pendingPass`/`isPassTargeting` in `clearSelection`/`advanceTurn`.
4. **`PieceMenu.tsx`**: Add "Pass" action (disabled when `passUsed` or piece has no `pa`).
5. **`App.tsx`**: Wire "Pass" menu action; route square clicks through `handlePassTarget` when `isPassTargeting`; update HUD status text.
6. **`Pitch.tsx`**: Render range overlay squares (`square--range-quick`, `square--range-short`, `square--range-long`, `square--range-bomb`); highlight receiver squares (`square--pass-receiver`).
7. **`Pitch.css`**: Style range band overlays and receiver highlight.
8. **`SubmitModal.tsx` / `ScoreSummary.tsx` / `DiceLog.tsx`**: Handle `kind: 'pass'` entries — show passer → receiver, range band, pass target, catch target, combined probability.
9. **`scenario-001.json` / `scenario-002.json`**: Add `pa` to all pieces.
10. **`App.tsx` `handleSubmit`**: Include `kind: 'pass'` in risky moves extraction; map `passTarget`/`rangeBand` into `RiskyMove`.

### Acceptance Criteria

1. "Pass" appears in the context menu for ball carriers; disabled if `passUsed`.
2. Declaring a pass selects the carrier for movement with `pendingPass: true`.
3. Clicking the carrier to end activation opens pass targeting: range overlay visible, eligible receivers highlighted.
4. Clicking a receiver executes the pass: pass target and catch target computed and logged, ball transfers, carrier activated.
5. Receiver can still be activated (moved) after catching.
6. Pass probability (pass roll × catch roll) multiplies into cumulative probability.
7. Pass entries appear in Action Log, submit modal, and score summary with range band and both roll targets.
8. `passUsed` prevents a second pass or handoff in the same turn.

---

## Scenario 002 — The Handoff Play

### Concept

The thrower has the ball but cannot reach the end zone alone. A catcher is positioned ahead, within handoff range after the thrower moves. Five orcs block the path. The optimal play is: thrower moves to the catcher's vicinity, hands off, catcher dodges through the remaining orcs and scores.

### Piece Layout (portrait coordinates: col 0–14, row 0–25; end zone = row 0 for humans)

| ID | Team | Role | Name | MA | AG | Position | Ball |
|---|---|---|---|---|---|---|---|
| `thrower` | human | thrower | Aldric Swiftfoot | 6 | 3 | col 7, row 14 | ✅ |
| `catcher` | human | catcher | Sera Quickhand | 8 | 4 | col 7, row 8 | ❌ |
| `orc1` | orc | blocker | Grukk Ironjaw | 4 | 3 | col 6, row 12 | ❌ |
| `orc2` | orc | blocker | Muzgash Skullkrak | 4 | 3 | col 8, row 12 | ❌ |
| `orc3` | orc | blitzer | Vrak Bonecruncher | 6 | 3 | col 6, row 9 | ❌ |
| `orc4` | orc | blitzer | Skrag Headsmash | 6 | 3 | col 8, row 9 | ❌ |
| `orc5` | orc | blocker | Dorg Gutripper | 4 | 3 | col 7, row 5 | ❌ |

### Intended Play

1. **Thrower** (MA 6) moves from row 14 toward row 9, dodging past orc1/orc2 (TZ coverage), ending adjacent to the catcher at row 8. Hands off.
2. **Catcher** (MA 8, AG 4) catches (2+ base with accurate modifier), then moves from row 8 toward row 0, dodging past orc3/orc4 and orc5, scoring a touchdown.

### Scenario JSON

```json
{
  "id": "scenario-002",
  "name": "The Handoff Play",
  "description": "The thrower can't reach the end zone alone. Hand off to the catcher and dodge through the orc line.",
  "activeTeam": "human",
  "pieces": [
    {
      "id": "thrower", "team": "human", "role": "thrower",
      "name": "Aldric Swiftfoot",
      "ma": 6, "st": 3, "ag": 3, "av": 8,
      "skills": ["Block"],
      "position": { "col": 7, "row": 14 },
      "hasBall": true
    },
    {
      "id": "catcher", "team": "human", "role": "catcher",
      "name": "Sera Quickhand",
      "ma": 8, "st": 2, "ag": 4, "av": 7,
      "skills": ["Catch", "Dodge"],
      "position": { "col": 7, "row": 8 },
      "hasBall": false
    },
    {
      "id": "orc1", "team": "orc", "role": "blocker",
      "name": "Grukk Ironjaw",
      "ma": 4, "st": 3, "ag": 3, "av": 9,
      "skills": ["Animosity"],
      "position": { "col": 6, "row": 12 },
      "hasBall": false
    },
    {
      "id": "orc2", "team": "orc", "role": "blocker",
      "name": "Muzgash Skullkrak",
      "ma": 4, "st": 3, "ag": 3, "av": 9,
      "skills": ["Animosity"],
      "position": { "col": 8, "row": 12 },
      "hasBall": false
    },
    {
      "id": "orc3", "team": "orc", "role": "blitzer",
      "name": "Vrak Bonecruncher",
      "ma": 6, "st": 3, "ag": 3, "av": 9,
      "skills": ["Block"],
      "position": { "col": 6, "row": 9 },
      "hasBall": false
    },
    {
      "id": "orc4", "team": "orc", "role": "blitzer",
      "name": "Skrag Headsmash",
      "ma": 6, "st": 3, "ag": 3, "av": 9,
      "skills": ["Block"],
      "position": { "col": 8, "row": 9 },
      "hasBall": false
    },
    {
      "id": "orc5", "team": "orc", "role": "blocker",
      "name": "Dorg Gutripper",
      "ma": 4, "st": 3, "ag": 3, "av": 9,
      "skills": ["Animosity"],
      "position": { "col": 7, "row": 5 },
      "hasBall": false
    }
  ]
}
```

### Acceptance Criteria

1. Thrower can move up to MA 6, then the PieceMenu shows "Hand Off" if the catcher is adjacent.
2. Clicking "Hand Off" highlights the catcher's square.
3. Clicking the catcher executes the handoff: catch target computed, logged, ball transfers.
4. Catcher (not yet activated) can then be selected and moved to the end zone.
5. Touchdown triggers the submission flow with cumulative probability including the catch roll.
6. Scenario appears in the scenario select screen alongside scenario-001.

---

---

## Problem Statement

A browser-based Blood Bowl puzzle game.

---

## Leaderboard — Move Summary on Row Click

### Problem Statement

Clicking a leaderboard row should show the risky moves (dodge/GFI steps) that produced that score, in the same format as the post-touchdown submit modal. Currently the `actionLog` is not persisted — only `probability` and `diceCount` are stored.

### Data Model Changes

Add `moves` to `LeaderboardEntry` — an array of risky-move-only entries (steps where `isGfi === true` or `dodgeTarget !== null`).

**Updated `LeaderboardEntry`:**
```ts
interface LeaderboardEntry {
  id: string;
  scenarioId: string;
  name: string;
  probability: number;
  diceCount: number;
  date: string;
  moves: RiskyMove[];
}

interface RiskyMove {
  pieceName: string;
  pieceRole: string;
  from: Position;
  to: Position;
  dodgeTarget: number | null;
  isGfi: boolean;
  actionProb: number;
  cumulativeProb: number;
}
```

### Storage

`moves` is stored inside the existing Blob entry alongside the other fields. No new Blob keys needed.

### Requirements

1. **`types.ts`**: Add `RiskyMove` type and `moves: RiskyMove[]` to `LeaderboardEntry`.
2. **`api.ts`**: Update `submitScore` to accept and send `moves` in the POST body.
3. **`netlify/functions/leaderboard.js`**: Accept `moves` in POST body, store and return it.
4. **`App.tsx`**: Build `moves` from `state.actionLog` (filter to risky steps) and pass to `submitScore`.
5. **`Leaderboard.tsx`**: Row click navigates to a `ScoreSummary` panel, passing the selected entry.
6. **`ScoreSummary.tsx`** (new): Displays the risky-moves table (Player · Type · Move · Action · Chance) and cumulative probability. Has a back button returning to the leaderboard.

### Acceptance Criteria

- Submitting a score stores risky moves in the Blob entry.
- Clicking a leaderboard row shows the move summary panel.
- Summary shows: Player, Type, Move, Action, Chance, cumulative probability.
- Back button returns to the leaderboard.
- Old entries without `moves` show "No move data available" gracefully.

### Implementation Steps

1. Add `RiskyMove` type and update `LeaderboardEntry` in `types.ts`.
2. Update `submitScore` in `api.ts` to include `moves` in the POST body.
3. Update `netlify/functions/leaderboard.js` to persist and return `moves`.
4. Update `App.tsx` `handleSubmit` to extract risky moves from `actionLog` and pass to `submitScore`.
5. Create `ScoreSummary.tsx` reusing the risky-moves table markup from `SubmitModal`.
6. Update `Leaderboard.tsx` to accept `onRowClick` prop and call it on row click.
7. Wire up navigation in `App.tsx` to show `ScoreSummary` when a row is clicked.

---

## Leaderboard — Netlify Deployment

### Problem Statement

The current Express server uses in-memory storage (lost on restart) and cannot run on Netlify. The goal is to deploy the full app on Netlify: the React frontend as a static site, and the leaderboard API as Netlify Functions backed by Netlify Blobs for persistence.

### Architecture

```
Netlify CDN
├── / (static)          → client/dist  (Vite build)
└── /.netlify/functions → netlify/functions/leaderboard.js
                          reads/writes Netlify Blobs (one blob per scenarioId)
```

The existing Express server (`server/`) is retained for local development only. In production, Netlify Functions replace it.

### Storage Model

One Netlify Blob per scenario, keyed by `scenarioId`. Each blob contains a JSON array of `LeaderboardEntry` objects. On every write the full array is read, upserted, sorted, trimmed to top 10, and written back.

```json
[
  { "id": "uuid", "scenarioId": "scenario-001", "name": "Alice",
    "probability": 0.694, "diceCount": 3, "date": "2026-05-02T..." },
  ...
]
```

### Requirements

1. **Netlify Function** at `netlify/functions/leaderboard.js` handles both GET and POST for `/api/leaderboard/:scenarioId`.
2. **GET**: Read blob for `scenarioId`, return top 10 sorted `probability DESC`, `diceCount ASC`. Return `[]` if blob doesn't exist yet.
3. **POST**: Read blob, upsert entry by `name` (replace existing entry for same name with latest submission), sort, trim to top 10, write blob back. Return the upserted entry.
4. **Routing**: `netlify.toml` rewrites `/api/*` to the function, and `/*` to `index.html` for SPA routing.
5. **Client `api.ts`**: No changes needed — `/api/leaderboard/:scenarioId` continues to work identically.
6. **Local dev**: Vite proxy (`/api` → `localhost:3001`) continues to route to the Express server. `netlify dev` can also be used as an alternative local runner.
7. **Build config**: `netlify.toml` sets `base = "client"`, `publish = "dist"`, `command = "npm run build"`.

### netlify.toml

```toml
[build]
  base    = "client"
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/api/*"
  to   = "/.netlify/functions/leaderboard"
  status = 200

[[redirects]]
  from   = "/*"
  to     = "/index.html"
  status = 200
```

### Acceptance Criteria

- `netlify build` succeeds and produces `client/dist`.
- GET `/api/leaderboard/scenario-001` returns `[]` on first call.
- POST then GET returns the submitted entry ranked correctly.
- Submitting the same name replaces the previous entry.
- Scores persist across function cold starts (stored in Blobs, not memory).
- Local dev with Express + Vite proxy continues to work unchanged.

### Implementation Steps

1. Create `netlify/functions/leaderboard.js`:
   - Import `@netlify/blobs` (`getStore`).
   - Parse `scenarioId` from the request path.
   - GET: read blob → parse JSON → return top 10.
   - POST: read blob → upsert by name → sort → trim → write blob → return entry.
2. Add `@netlify/blobs` to a new `netlify/package.json` (or root `package.json`).
3. Create `netlify.toml` at repo root with build config and redirects above.
4. Update `client/vite.config.ts`: keep the `/api` proxy for local dev; no other changes.
5. Add `netlify/node_modules` and `.netlify` to `.gitignore`.
6. Test locally with `netlify dev` or the existing Vite + Express setup. Each scenario presents a fixed pitch state (piece positions, ball position, opponent positions). The player plans a sequence of activations to move the ball carrier into the end zone. The game tracks the cumulative probability of the chosen sequence succeeding. On touchdown, the score (probability % + dice roll count) is submitted to a global leaderboard. Players compete to find the highest-probability route to a touchdown.

The current prototype (hot-seat two-player free play) remains as a sandbox/dev mode. The puzzle mode is the primary product.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript (Vite) |
| Backend | Node.js (Express) — serves frontend, hosts leaderboard API |
| Database | Stubbed in-memory for now; interface designed for Supabase/Postgres later |
| Styling | Plain CSS |

---

## Mode 1 — Free Play (existing, keep as-is)

Hot-seat two-player sandbox. No scenarios, no leaderboard. Used for development and casual play.

---

## Mode 2 — Puzzle Mode (new)

### Scenario Definition

Scenarios are JSON files loaded at startup from `client/src/scenarios/`.

```jsonc
{
  "id": "scenario-001",
  "name": "The Simple Run",
  "description": "One blocker in the way. Find the safest path.",
  "activeTeam": "human",
  "pieces": [
    { "id": "carrier", "team": "human", "name": "Blitzer", "ma": 7, "st": 3, "ag": 3, "av": 8, "skills": ["Block", "Dodge"], "position": { "col": 10, "row": 7 }, "hasBall": true },
    { "id": "support", "team": "human", "name": "Lineman", "ma": 6, "st": 3, "ag": 3, "av": 8, "skills": [], "position": { "col": 9, "row": 6 }, "hasBall": false },
    { "id": "opp1",    "team": "orc",   "name": "Orc Blitzer", "ma": 6, "st": 3, "ag": 3, "av": 9, "skills": ["Block"], "position": { "col": 14, "row": 7 }, "hasBall": false }
  ]
}
```

Fields:
- `id` — unique string, used as leaderboard key
- `activeTeam` — which team the player controls
- `pieces` — full roster; opponent pieces are static (no AI, no activation)
- `hasBall` — exactly one piece starts with the ball

### Ball

- The ball is displayed on the pitch as a distinct marker on its carrier's square.
- Ball carrier is visually distinguished (e.g. star or ring on the piece).
- Ball mechanics beyond carrying (pickup, passing) are **deferred** — implemented in a later iteration.

### Touchdown Condition

- When the ball carrier's planned path ends in the opponent's end zone (col 25 for human team, col 0 for orc team) and the player clicks **End Turn**, the move is treated as a touchdown attempt.
- All queued dodge rolls are resolved. If all succeed, touchdown is scored and the submission flow triggers.
- If any dodge fails, the attempt fails (no submission).

### Probability Tracking

- Every dice roll required along the sequence contributes to a running cumulative probability (product of individual success chances).
- Displayed live as the player plans: e.g. "Success chance: 67%".
- On touchdown, the final probability and dice roll count are locked in.

### Submission Flow

1. Touchdown confirmed → modal shows final probability % and dice count.
2. Player enters a display name.
3. Score submitted to leaderboard API: `POST /api/leaderboard/:scenarioId` with `{ name, probability, diceCount, sequence }`.
4. Leaderboard shown immediately after submission.

### Leaderboard

- Per scenario, ranked by **probability % descending**, tiebroken by **dice count ascending** (fewer rolls = cleaner play).
- Shows: rank, name, probability %, dice count, date.
- Accessible from the scenario select screen at any time.
- API: `GET /api/leaderboard/:scenarioId` returns top 20 entries.

### Leaderboard API (stubbed)

The Express server exposes:

```
GET  /api/leaderboard/:scenarioId   → top 20 entries (in-memory for now)
POST /api/leaderboard/:scenarioId   → submit a score
```

In-memory store is replaced with a real database (Supabase/Postgres) in a later iteration without changing the API contract.

---

## Acceptance Criteria

### Scenario loading
1. Scenarios are read from JSON files in `client/src/scenarios/` at build time.
2. A scenario select screen lists all available scenarios with name and description.
3. Selecting a scenario loads the pitch with the defined piece positions and ball.

### Puzzle play
4. Only the `activeTeam` pieces are selectable; opponent pieces are static.
5. The ball marker is visible on the carrier's square.
6. Cumulative probability updates live as the player adds dodge steps to their path.
7. Clicking End Turn with the ball carrier's path ending in the end zone triggers touchdown resolution.
8. A failed dodge during touchdown resolution shows a failure modal (no submission).

### Submission & leaderboard
9. A successful touchdown shows a modal with probability % and dice count, and a name input.
10. Submitting posts to `POST /api/leaderboard/:scenarioId`.
11. The leaderboard screen shows entries ranked by probability desc, dice count asc.
12. The leaderboard is accessible without playing (from scenario select).

---

## Implementation Steps

1. **Scenario type + loader** — define `Scenario` TypeScript type; load JSON files via Vite's `import.meta.glob`; add `hasBall` to `PlayerPiece`.
2. **Scenario select screen** — new route/view listing scenarios with name, description, leaderboard button.
3. **Puzzle game mode** — fork game state initialisation to load from a `Scenario`; lock opponent pieces (no selection, no activation).
4. **Ball rendering** — display ball marker on carrier square; visually distinguish carrier piece.
5. **Touchdown detection** — in `handleEndTurn`, check if ball carrier's planned path tip is in the end zone; trigger resolution flow.
6. **Submission modal** — name input + probability/dice summary; calls leaderboard API on confirm.
7. **Leaderboard API** — Express routes `GET/POST /api/leaderboard/:scenarioId`; in-memory store with the correct sort order.
8. **Leaderboard view** — table component showing rank, name, probability %, dice count, date.
9. **First scenario JSON** — author one playable scenario to validate the full flow end-to-end.
10. **Wire routing** — home → scenario select → puzzle play → submission → leaderboard.

---
---

# Series Mode Specification

## Problem Statement

Today the home screen (`ScenarioSelect`) lists individual puzzle scenarios, each played and
scored independently on its own leaderboard. The user wants a new primary flow: a **Series**
of 5 puzzles played back-to-back under one name, with a combined result (average success
probability across all 5) posted to a new **Series Leaderboard**. Existing per-puzzle
leaderboards and standalone Play/Leaderboard/Sandbox options must continue to work unchanged.

## Requirements

### 1. Scenario content
- Author 3 new scenario JSON files (`scenario-003.json`, `scenario-004.json`,
  `scenario-005.json`) in `client/src/scenarios/`, following the existing schema
  (see `scenario-001.json` / `scenario-002.json`). Each should be a distinct, solvable
  puzzle (varying piece counts / layouts / risk profile), consistent with existing tone
  and naming (human vs orc pieces, thrower/catcher/blocker/blitzer roles).
- The series is fixed to these 5 scenarios in **ascending `id` order**
  (`scenario-001` → `scenario-005`).

### 2. Home screen changes
- Add a new primary entry point, e.g. "Start Series" button, alongside the existing
  per-scenario Play/Leaderboard list and the Sandbox button (all existing options remain
  as-is).
- Add a "Series Leaderboard" entry point (separate from per-puzzle leaderboards) to view
  the combined-score board.

### 3. Series entry flow
- Clicking "Start Series" prompts for the player's name **once**, before puzzle 1 begins
  (new simple name-entry screen/modal — reuse `SubmitModal`-style input UI).
- After name entry, load puzzle 1 (`scenario-001`) in puzzle mode immediately.

### 4. Playing through the series
- Puzzles are played in fixed order 1 → 5, using the existing single-puzzle gameplay
  (`useGameState` / `makeScenarioState`), unchanged.
- **Touchdown reached**: show the existing touchdown breakdown modal (move list +
  cumulative probability), but in series mode:
  - No name field (name already captured at series start).
  - No "Skip" option.
  - Button reads "Continue" (or "Continue to Puzzle N+1" / "Finish Series" on puzzle 5).
  - On Continue: submit the score to **both** (a) that puzzle's individual leaderboard
    (existing `submitScore(scenarioId, ...)` — unchanged), and (b) record the puzzle's
    probability into the in-progress series run state.
  - If not the last puzzle: advance to the next scenario in the series automatically.
  - If it was puzzle 5: compute the average probability across all 5 puzzle results and
    submit the combined series entry to the new series leaderboard, then show the Series
    Leaderboard screen with the new entry highlighted.
- **Failure to score a touchdown** (player's turns run out without a touchdown, i.e. the
  puzzle's turn/phase logic reaches a non-touchdown end state): force a retry of that same
  puzzle — reset it via `makeScenarioState(scenario)` — the player must keep retrying
  until they score a touchdown before the series can advance. (Mirrors existing puzzle
  "↺ Restart" behavior in `App.tsx`; series flow additionally auto-restarts on a failed
  end state rather than returning to the home menu.)
- Series progress (current puzzle index, player name, probabilities collected so far)
  is held in in-memory React state in `App.tsx` (no persistence needed across page
  reload — reloading loses series progress, same as today's single-puzzle behavior).

### 5. Leaving mid-series
- Clicking "← Menu" during a series run shows a confirmation dialog
  ("Leave series? Your progress will be lost.") before navigating back to the home
  screen. Confirming discards all series-run state; canceling keeps the player on the
  current puzzle.

### 6. Combined probability calculation
- Combined score = **arithmetic mean** of the 5 individual puzzle `cumulativeProb` values
  (each in range 0–1), stored as `probability` on the series entry (same 0–1 scale as
  existing per-puzzle entries, so existing `pct()` formatting works unchanged).

### 7. Series leaderboard (new)
- New data model, `SeriesLeaderboardEntry`:
  ```ts
  interface SeriesLeaderboardEntry {
    id: string;
    name: string;
    probability: number;       // average of the 5 puzzle probabilities
    date: string;
    puzzles: {                 // one per scenario, in series order
      scenarioId: string;
      scenarioName: string;
      probability: number;
      diceCount: number;
      moves: RiskyMove[];
    }[];
  }
  ```
- New API endpoints, mirroring the existing per-scenario leaderboard pattern:
  - `GET /api/series-leaderboard` → top N series entries sorted by `probability` desc.
  - `POST /api/series-leaderboard` → submit a new series entry (same upsert-by-name
    behavior as `netlify/functions/leaderboard.js`, i.e. replace an existing entry for
    the same name if a better/newer one is submitted — follow existing sort tie-break:
    higher probability wins; use total dice/rolls count across puzzles as tie-break to
    mirror the existing pattern).
  - Implement in both `server/index.js` (Express, in-memory `Map`) and
    `netlify/functions/leaderboard.js` (extend it or add a new
    `netlify/functions/series-leaderboard.js` using Netlify Blobs — mirror the existing
    file's structure) plus corresponding `netlify.toml` redirect
    (`/api/series-leaderboard` → the new function).
  - Add `fetchSeriesLeaderboard()` / `submitSeriesScore()` to `client/src/api.ts`.
- New `SeriesLeaderboard.tsx` component (list view), styled consistently with the
  existing `Leaderboard.tsx`:
  - Columns: rank, name, average probability, date.
  - Clicking a row expands/navigates to a per-puzzle breakdown view showing each of the
    5 puzzle results (scenario name, probability, dice count) — reuse/extend the
    `ScoreSummary` pattern (a `SeriesScoreSummary` component, or extend `ScoreSummary`
    to accept a list of puzzle summaries).

### 8. Non-goals / out of scope
- No changes to Sandbox (free play) mode.
- No changes to individual puzzle gameplay mechanics, dice math, or BFS pathing.
- No persistence of in-progress series across browser reload/close.
- No server-side validation of "5 real playthroughs" — client computes and submits the
  average, same trust model as existing per-puzzle score submission.
- No user-configurable series length — always exactly 5, in fixed order.

## Acceptance Criteria

1. Home screen shows a "Start Series" option plus a "Series Leaderboard" option,
   alongside existing per-scenario Play/Leaderboard rows and the Sandbox button.
2. Starting a series prompts for a name once, then loads `scenario-001` in puzzle mode.
3. Scoring a touchdown on a series puzzle shows the breakdown modal with a
   "Continue"-style action (no name entry, no Skip); confirming submits to that
   scenario's individual leaderboard and advances to the next scenario in order.
4. Failing to score a touchdown on a series puzzle automatically restarts that same
   puzzle; the player cannot advance without a touchdown.
5. After completing puzzle 5's touchdown, the app computes the average of the 5
   cumulative probabilities, submits a new series leaderboard entry, and displays the
   Series Leaderboard with that entry visible/highlighted.
6. The Series Leaderboard lists entries sorted by average probability (desc); clicking
   an entry shows a breakdown of all 5 puzzle results for that run.
7. Clicking "← Menu" mid-series shows a confirmation dialog; confirming abandons the
   series and returns home, canceling keeps the current puzzle state intact.
8. All 5 scenarios (`scenario-001`..`scenario-005`) exist, load via the existing
   `import.meta.glob` scenario index, and are independently playable/leaderboard-able
   exactly as scenario-001/002 are today.
9. `npm run lint` and `npm run build` (client) pass with no new errors.
10. Existing standalone Play / per-scenario Leaderboard / Sandbox flows are unaffected
    (manually verified unchanged behavior).

## Implementation Approach

1. **Scenario content**: Author `scenario-003.json`, `scenario-004.json`,
   `scenario-005.json` under `client/src/scenarios/`.
2. **Types**: Add `SeriesLeaderboardEntry` and any supporting types to `client/src/types.ts`;
   extend `AppMode` with new modes (e.g. `'series-name'`, `'series-play'`,
   `'series-leaderboard'`) as needed.
3. **API client**: Add `fetchSeriesLeaderboard()` / `submitSeriesScore()` to
   `client/src/api.ts`.
4. **Server (dev)**: Add `/api/series-leaderboard` GET/POST routes to `server/index.js`
   with an in-memory store, mirroring existing per-scenario logic.
5. **Server (prod)**: Add `netlify/functions/series-leaderboard.js` (Netlify Blobs,
   mirroring `leaderboard.js`) and register the redirect in `netlify.toml`.
6. **Series state management**: In `App.tsx`, add series-run state (current puzzle
   index, player name, array of per-puzzle results collected so far) and orchestration
   logic:
   - `startSeries()` → show name entry.
   - `beginSeriesPuzzle(name)` → initialize series state, load scenario-001.
   - Modify touchdown handling: in series mode, submit to per-puzzle leaderboard,
     record result, then either load next scenario or finalize+submit series entry.
   - Modify failure/non-touchdown end-of-puzzle handling to auto-restart via
     `makeScenarioState`.
   - Add confirmation dialog on "← Menu" click while a series is active.
7. **UI components**:
   - Add a name-entry screen/modal for series start (reuse `SubmitModal` styling or a
     new lightweight component).
   - Adjust `SubmitModal` (or add a `SeriesSubmitModal` variant) to hide name input and
     Skip button, and relabel the primary button, when in series mode.
   - Add `SeriesLeaderboard.tsx` (+ CSS) for the combined board.
   - Add a breakdown view for a series entry (extend `ScoreSummary` or add
     `SeriesScoreSummary.tsx`).
   - Update `ScenarioSelect.tsx` to add "Start Series" and "Series Leaderboard" entry
     points.
8. **Verification**: Run `cd client && npm run lint` and `npm run build`; manually
   exercise the full series flow (all 5 puzzles, one forced failure/retry, series
   leaderboard submission and breakdown view) and confirm standalone Play/Leaderboard/
   Sandbox flows are unaffected.

---

# Google Social Sign-On Plan

## Purpose

Add optional social sign-on so players can use a Google account for leaderboard identity,
personal progress, and rank tracking without changing the core puzzle gameplay.

This section records the sign-on implementation plan and the first implemented pass.

## Assumptions

- Use direct Google Identity Services rather than a managed auth provider.
- Sign-in is optional for playing challenges.
- Signed-in submissions use the verified Google profile name by default.
- Existing anonymous/manual-name leaderboard submissions remain supported during the
  initial rollout.
- Production storage remains Netlify Blobs for the first version.
- Local development continues to use the Express API and in-memory stores.

Reference documentation:

- Google Identity Services overview:
  `https://developers.google.com/identity/gsi/web/guides/overview`
- Google ID token verification:
  `https://developers.google.com/identity/gsi/web/guides/verify-google-id-token`
- Google Auth Library for Node.js:
  `https://github.com/googleapis/google-auth-library-nodejs`

## Requirements

### User Experience

- The home screen shows sign-in state:
  - Signed out: a Google sign-in button.
  - Signed in: display name/avatar and a sign-out action.
- Signed-in players can submit individual challenge scores without typing a name.
- Signed-in players can submit series scores without typing a name.
- Leaderboard entries submitted while signed in are linked to a stable user identity.
- Home screen progress should prefer signed-in user history when available.
- Existing local-device progress remains a fallback for signed-out users.
- Public leaderboard viewing stays available while signed out.
- Signing out does not delete previously submitted leaderboard entries.

### Backend Behavior

- Score submission endpoints accept an optional bearer token:

```txt
Authorization: Bearer <google-id-token>
```

- If a bearer token is present:
  - Verify it server-side before trusting identity fields.
  - Reject invalid tokens with `401`.
  - Store verified auth metadata on the leaderboard entry.
- If no bearer token is present:
  - Preserve current anonymous/manual-name submission behavior unless product policy
    later requires sign-in for ranked submissions.
- GET leaderboard endpoints remain public.

### Token Verification

The backend must verify:

- Signature is valid.
- Token is not expired.
- `aud` matches configured Google OAuth client ID.
- `iss` is a valid Google issuer.

Use Google `sub` as the stable identity key, not email.

## Constraints

- Current app architecture:
  - `client/`: React + TypeScript + Vite.
  - `server/index.js`: local Express API with in-memory leaderboards.
  - `netlify/functions/`: production serverless APIs.
  - Netlify Blobs: production leaderboard persistence.
- There is no current auth/session layer.
- There is no current persistent user table.
- Netlify Blobs are acceptable for small user-history and leaderboard datasets, but not
  ideal for complex account queries.
- Do not expose Google client secrets to the frontend.
- Do not store Google access tokens in browser storage.
- The first version should avoid long-lived custom sessions; verify ID tokens on submit.

## Architecture

### Frontend

Add:

```txt
client/src/auth.ts
client/src/AuthProvider.tsx
```

Responsibilities:

- Load and initialize Google Identity Services.
- Hold current auth state in React.
- Expose:
  - `currentUser`
  - `idToken`
  - `signIn()`
  - `signOut()`
- Decode client-side credential only for immediate display.
- Treat backend-verified identity as authoritative for score writes.

Update:

```txt
client/src/api.ts
```

- `submitScore(...)` accepts optional `idToken`.
- `submitSeriesScore(...)` accepts optional `idToken`.
- When an ID token exists, send `Authorization: Bearer <idToken>`.

Update UI:

- Home/front screen:
  - Add sign-in status near top-level navigation.
  - Use signed-in history for "played before / best % / rank".
- `SubmitModal`:
  - Signed in: show account identity and submit under that identity.
  - Signed out: keep the current manual name input.
- `SeriesNameEntry`:
  - Signed in: default to account display name.
  - Signed out: keep current name entry.

### Local Express API

Add:

```txt
server/auth.js
```

Responsibilities:

- Extract bearer token.
- Verify ID token with `google-auth-library`.
- Return normalized user:

```js
{
  provider: 'google',
  providerUserId: payload.sub,
  name: payload.name,
  email: payload.email,
  picture: payload.picture
}
```

Update:

- `POST /api/leaderboard/:scenarioId`
- `POST /api/series-leaderboard`

If token is valid, store verified identity fields on entries. If token is missing, keep
anonymous behavior. If token is present but invalid, return `401`.

### Netlify Functions

Add:

```txt
netlify/functions/auth.js
```

Update:

- `netlify/functions/leaderboard.js`
- `netlify/functions/series-leaderboard.js`

The production auth helper should mirror the Express helper and use the same environment
variables.

### Storage Shape

Extend leaderboard entries with optional auth fields:

```ts
type AuthenticatedEntryFields = {
  userId?: string;          // Google sub or derived app-scoped ID
  authProvider?: 'google';
  displayName?: string;
  avatarUrl?: string;
};
```

Apply those fields to:

- `LeaderboardEntry`
- `SeriesLeaderboardEntry`

For more reliable personal history, add a separate blob store:

```txt
store: user-scores
key: google:<sub>
```

Suggested value:

```ts
{
  userId: string;
  displayName?: string;
  avatarUrl?: string;
  individual: Record<string, string[]>; // scenarioId -> leaderboard entry IDs
  series: string[];                     // series leaderboard entry IDs
}
```

This avoids relying only on top-N leaderboard rows to determine whether a signed-in user
has played before.

## Environment Variables

Frontend:

```txt
VITE_GOOGLE_CLIENT_ID=<google web oauth client id>
```

Server and Netlify functions:

```txt
GOOGLE_CLIENT_ID=<same google web oauth client id>
```

Existing Netlify Blobs variables remain:

```txt
NETLIFY_SITE_ID / SITE_ID
NETLIFY_TOKEN / NETLIFY_AUTH_TOKEN
```

## Implementation Steps

1. Create a Google Cloud OAuth web client.
   - Configure local dev, preview, and production origins.
   - Add `VITE_GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_ID`.

2. Add frontend auth provider.
   - Initialize Google Identity Services.
   - Add sign-in/sign-out state and UI.
   - Keep tokens in memory for submit requests.

3. Update API client.
   - Add optional ID-token support to individual and series score submission.
   - Keep GET endpoints unchanged.

4. Add Express token verification.
   - Add `server/auth.js`.
   - Verify bearer token for submission endpoints.
   - Store optional verified user metadata.

5. Add Netlify token verification.
   - Add `netlify/functions/auth.js`.
   - Apply to leaderboard and series leaderboard functions.

6. Add user-history persistence.
   - Write per-user submitted entry IDs to Netlify Blobs in production.
   - Keep a local/in-memory equivalent for Express dev if useful.

7. Update front-screen progress logic.
   - Prefer signed-in user history.
   - Fall back to local-device submitted entry IDs.
   - Preserve "not played" state for users with no history.

8. Update score submission UI.
   - Use signed-in display name by default.
   - Keep manual-name submission when signed out.

9. Verify.
   - `npm run build`
   - `cd client && npm run lint`
   - Local signed-out submission.
   - Local signed-in submission with valid token.
   - Invalid-token submission returns `401`.
   - Netlify preview signed-in submission.

## Success Criteria

- A player can sign in with Google from the app.
- The app shows signed-in profile state and supports sign out.
- Signed-in individual challenge submissions are tied to verified Google identity.
- Signed-in series submissions are tied to verified Google identity.
- Invalid bearer tokens are rejected server-side.
- Public leaderboard viewing still works when signed out.
- Existing anonymous leaderboard entries still display.
- Home screen progress can show played/best/rank for signed-in users.
- Anonymous/manual-name submission remains available unless intentionally disabled.
- Build and lint pass.

## Future Enhancements

- Require sign-in for ranked submissions while leaving practice play public.
- Protect Admin Mode with an allowlist of Google user IDs.
- Add an account page with full score history.
- Move user and leaderboard history from Netlify Blobs to a relational database if query
  needs grow.
- Add other social providers through a managed auth service if Google-only becomes too
  narrow.

---

# Puzzle Editor / Creator Plan

## Purpose

Replace the current Admin Mode sandbox entry point with a puzzle editor that can create,
edit, validate, and organize Blood Bowl tactics puzzles using the same pitch and scenario
shape the game already runs.

The editor should let an admin build a puzzle visually:

- choose available teams and player types from a palette,
- drag players onto the pitch,
- place the ball,
- save over an existing puzzle or create a new puzzle,
- assign puzzles to the current series.

## Current State

The app currently stores playable puzzles as static JSON files in:

```txt
client/src/scenarios/*.json
```

They are loaded at build time through:

```txt
client/src/scenarios/index.ts
```

The current `Scenario` data shape is:

```ts
{
  id: string;
  name: string;
  description: string;
  activeTeam: 'human' | 'orc';
  pieces: ScenarioPieceDef[];
}
```

Each `ScenarioPieceDef` includes team, role/name, core stats, skills, board position, and
`hasBall`.

The current series flow uses the ordered `scenarios` array directly. There is no separate
series metadata file yet.

Admin Mode currently exposes sandbox/free-play behavior. The editor should take over this
screen as the default admin destination. Free-play can remain as a secondary admin tool if
useful, but it should no longer be the main Admin Mode experience.

## Assumptions

These are planning assumptions because clarification tooling was unavailable:

- First implementation is local-file based, not a production CMS.
- Saved puzzles generate or update JSON compatible with `client/src/scenarios/*.json`.
- The editor is admin-only and remains behind the existing Admin Mode entry point.
- The first series implementation supports one current series with ordered puzzle
  assignment.
- Humans and Orcs are the initial supported teams because they are the teams currently in
  the app.
- The editor uses existing pitch dimensions and position coordinates:
  - columns `0..25`
  - rows `0..14`
- The active team is still selected per puzzle, with humans as the normal scoring team
  for the current puzzle set unless changed in editor metadata.
- Production admin access should be based on verified Google user IDs (`sub`), not
  display names.

If the product direction changes to browser-based production editing, this plan should be
extended with authenticated admin APIs and persistent backend storage.

## Requirements

### Editor Entry

- Replace the current Admin Mode screen with Puzzle Editor.
- Keep a way back to the main menu.
- Remove Sandbox/Free Play from Admin Mode for this first editor pass.
- The editor should be unavailable to normal players if production admin authorization is
  later added.

### Puzzle List

- Show existing puzzles loaded from `client/src/scenarios`.
- Each puzzle row/card should show:
  - puzzle name,
  - scenario id,
  - description,
  - active team,
  - number of pieces,
  - whether it is assigned to the current series.
- Selecting a puzzle loads it into the editor.
- Provide a "New Puzzle" action.
- Provide a duplicate/copy action if it is cheap, because new puzzles will often start
  from an existing layout.

### Pitch Editing

- Use the same pitch coordinate system and visual pitch component concepts as gameplay.
- Allow placing, moving, selecting, and deleting pieces.
- Drag from palette to pitch to create a piece.
- Drag an existing piece to another empty square.
- Clicking/selecting a piece opens an inspector for editable fields.
- Prevent multiple pieces from occupying the same square.
- Show the ball location clearly.
- Allow assigning the ball by:
  - selecting a "Ball" tool and clicking a square or player,
  - or toggling "has ball" on a selected player.
- Enforce one ball per puzzle.
- If the ball is on a player, exactly one piece should have `hasBall: true`.
- Support a loose ball with a separate `ballPosition` field. Gameplay can fully solve
  carried-ball puzzles first; loose-ball gameplay behavior can be expanded later.

### Palette

- Provide a palette grouped by team:
  - Humans
  - Orcs
- Each team group contains player type templates derived from existing scenario data and
  the current game rules.
- Initial templates should include at least the roles already represented in scenarios:
  - Human thrower
  - Human catcher/runner/lineman as available from existing scenarios
  - Orc blocker
  - Orc guard/tackle/lineman as available from existing scenarios
- A palette item should define:
  - team,
  - role,
  - default name prefix,
  - MA/ST/AG/PA/AV,
  - default skills.
- Dragging a template onto the pitch creates a unique piece id and display name.

### Piece Inspector

- Selecting a placed player should allow editing:
  - name,
  - team,
  - role,
  - MA/ST/AG/PA/AV,
  - skills,
  - has ball,
  - position, preferably through dragging rather than manual coordinate entry.
- Stats should use bounded numeric inputs.
- Skills can start as a comma-separated input if a full skill picker is too large for the
  first pass.
- The inspector should include a delete action.

### Puzzle Metadata

- Editable fields:
  - id,
  - name,
  - description,
  - active team.
- For new puzzles:
  - generate a slug-like id such as `scenario-006` or a name-derived id,
  - validate uniqueness before save.
- For existing puzzles:
  - allow "Save" to overwrite the current puzzle data,
  - allow "Save As New" to create a new id.

### Validation

Before save, validate:

- id is non-empty and unique for new puzzles,
- name is non-empty,
- description is non-empty,
- active team is valid,
- every piece has a unique id,
- every piece has a valid team,
- every piece has a valid position within the pitch,
- no two pieces share the same square,
- exactly one ball exists, either carried by one player or placed loose on the pitch,
- at least one piece belongs to the active team,
- all stats are numbers in valid ranges.

Validation errors should be visible and actionable, not hidden in console output.

### Save / Export

First-pass local-file approach:

- The editor should produce JSON in the current `Scenario` format.
- Saving over an existing puzzle should update its JSON representation.
- Creating a new puzzle should produce a new JSON representation.
- Because browser code cannot safely write to repo files by itself, choose one of these
  implementation paths:
  - add a local development API endpoint that writes to `client/src/scenarios/*.json`, or
  - provide an export/download/copy JSON action and commit generated files manually.

Recommended first implementation:

- Add local Express-only editor API endpoints for development:

```txt
GET  /api/editor/scenarios
PUT  /api/editor/scenarios/:scenarioId
POST /api/editor/scenarios
```

- These endpoints write formatted JSON to `client/src/scenarios`.
- They are local/admin tooling only and should not be exposed as public production write
  endpoints.
- In Netlify production, editor save should be disabled unless a protected storage-backed
  admin API is explicitly built.

### Series Assignment

Add a series metadata model instead of relying only on sorted scenario ids.

Recommended first-pass file:

```txt
client/src/series/default.json
```

Shape:

```ts
{
  id: 'default',
  name: string,
  description: string,
  scenarioIds: string[]
}
```

Requirements:

- Editor can add/remove a puzzle from the default series.
- Editor can reorder puzzles in the default series.
- Series Play should use `default.json.scenarioIds` instead of every scenario sorted by id.
- Individual play should still show all scenarios, including scenarios not assigned to the
  series.
- If a series references a missing scenario id, show an editor validation warning and skip
  or block gameplay until fixed.

## Constraints

- Keep edits compatible with the existing `Scenario` and `ScenarioPieceDef` gameplay
  consumers.
- Avoid changing movement/pathfinding rules as part of the editor work.
- Avoid introducing a database for the first pass unless production editing becomes a
  requirement.
- Do not let public production users write arbitrary scenario JSON.
- Do not store generated content in localStorage as the source of truth; localStorage can
  be used only for unsaved draft recovery.
- Build still uses Vite and static scenario imports, so file-backed scenario changes
  require rebuild/reload to ship.
- The project has no monorepo tooling; client/server changes remain in their existing
  package boundaries.
- TypeScript `noUnusedLocals` / `noUnusedParameters` are enforced by build.

## Architecture

### Frontend Components

Add editor-specific components under:

```txt
client/src/editor/
```

Suggested modules:

```txt
client/src/editor/PuzzleEditor.tsx
client/src/editor/PuzzleList.tsx
client/src/editor/EditorPitch.tsx
client/src/editor/PlayerPalette.tsx
client/src/editor/PieceInspector.tsx
client/src/editor/PuzzleMetadataForm.tsx
client/src/editor/SeriesAssignment.tsx
client/src/editor/editorTypes.ts
client/src/editor/editorValidation.ts
client/src/editor/playerTemplates.ts
```

Responsibilities:

- `PuzzleEditor`: top-level editor state and save orchestration.
- `PuzzleList`: existing/new/copy puzzle selection.
- `EditorPitch`: pitch drop targets, piece selection, piece movement, ball placement.
- `PlayerPalette`: team and role templates.
- `PieceInspector`: selected piece editing.
- `PuzzleMetadataForm`: scenario id/name/description/active team.
- `SeriesAssignment`: default series inclusion and ordering.
- `editorValidation`: pure validation helpers.
- `playerTemplates`: current supported team/player templates.

Use structured scenario objects throughout; do not manipulate JSON strings except at
import/export boundaries.

### App Integration

Update app mode behavior:

- Keep `AppMode` value `admin` or rename to `editor` if the refactor is clean.
- The Admin Mode screen should render `PuzzleEditor`.
- Sandbox/Free Play is removed from Admin Mode in this pass.

### API Integration

Local Express development API:

```txt
server/editor.js
```

Responsibilities:

- read scenarios from `client/src/scenarios`,
- validate incoming scenario JSON,
- write formatted JSON,
- create new scenario files,
- optionally read/write `client/src/series/default.json`.

Do not add equivalent Netlify write functions in first pass unless production editing is
explicitly required.

Production behavior:

- Editor can be hidden, read-only, or export-only.
- If production editing is required later, use Google sign-in plus an admin allowlist and
  protected Netlify functions or a database.

### Series Data Loading

Add:

```txt
client/src/series/index.ts
client/src/series/default.json
```

`series/index.ts` should resolve scenario ids to `Scenario[]` for Series Play.

Update Series Play in `App.tsx` to use the default series list instead of the full
`scenarios` array.

## Implementation Steps

1. Define editor data helpers.
   - Add player templates for current Human/Orc roles.
   - Add scenario clone/normalize helpers.
   - Add validation functions and tests if practical.

2. Add series metadata.
   - Create `client/src/series/default.json`.
   - Add loader helpers that resolve `scenarioIds`.
   - Update Series Play to use the default series.

3. Replace Admin Mode UI.
   - Render `PuzzleEditor` from the admin route.
   - Remove the old Sandbox action.

4. Build editor layout.
   - Puzzle list on one side.
   - Pitch in the center.
   - Palette and inspector in side panels.
   - Metadata and series assignment controls in compact panels.

5. Implement drag/drop and selection.
   - Drag palette templates to pitch.
   - Move existing pieces.
   - Select/delete pieces.
   - Assign ball.

6. Implement validation.
   - Show blocking save errors.
   - Highlight invalid positions or duplicate ball state.

7. Implement save/export.
   - Add local Express editor endpoints.
   - Wire save over existing puzzle.
   - Wire save as new puzzle.
   - Wire series assignment save.
   - Add export JSON fallback if file write is disabled.

8. Verify gameplay compatibility.
   - Load every existing scenario.
   - Play a saved/edited scenario.
   - Run Series Play with the new series metadata.

9. Run checks.
   - `npm run build`
   - `cd client && npm run lint`
   - Manual editor smoke test:
     - create new puzzle,
     - drag Human and Orc players,
     - assign ball,
     - save,
     - reload,
     - play puzzle,
     - assign to series and run series.

## Success Criteria

- Admin Mode opens the puzzle editor instead of the old sandbox-first screen.
- An admin can create a new puzzle visually using player templates.
- An admin can edit an existing puzzle and save over it.
- An admin can save an edited puzzle as a new puzzle with a unique id.
- The editor prevents invalid saves with clear validation messages.
- A puzzle can contain Human and Orc players placed by drag/drop.
- Exactly one ball can be set, either carried by a player or placed loose on the pitch.
- Saved puzzle JSON is compatible with the current gameplay engine.
- Individual play can show and launch newly created puzzles.
- Series Play uses explicit series assignment instead of all scenarios by sorted id.
- The editor can assign/reorder puzzles in the default series.
- Build and lint pass.

## Future Enhancements

- Production editor backed by protected APIs and persistent storage.
- Google-account admin allowlist for editor access.
- Multiple named series.
- Loose-ball scenario support with `ballPosition`.
- Full skill picker with rule validation.
- Undo/redo for editor changes.
- Draft autosave and restore.
- Import/export scenario packs.
- Visual validation overlays for tackle zones and likely routes.

---

## Bug Fix — Pass/Handoff fails when receiver already activated this turn

### Problem Statement

Reported bug ("long bomb" scenario, `scenario-003.json`, but the defect is
in shared game logic, not scenario-specific):

1. Move the catcher into the end zone (catcher's activation ends, so
   `activated: true` is set on that piece).
2. Activate the thrower (still holding the ball), choose "Pass", move it,
   then attempt to complete the pass to the catcher.
3. The pass cannot be completed — the catcher does not appear as a legal
   target — even though the catcher is a legal in-range receiver by the
   rules (a player does not need to be "unactivated" to catch a pass).
4. Because no receiver square was ever clicked, `handlePassTarget` never
   runs, so the thrower's `activated` flag is never set to `true`.
5. The player can then reselect and move the same thrower again for free
   in the same turn, since the game only prevents reselecting pieces
   where `activated === true`.

### Root Cause (confirmed by code reading)

In `client/src/useGameState.ts`:

- The `pendingPass` branch of `handleSquareClick` (~line 237) builds
  `passReceiverKeys` by filtering candidates with `!piece.activated` —
  this incorrectly excludes teammates who already completed their own
  activation earlier in the turn.
- The equivalent `pendingHandoff` branch (~line 279) has the identical
  `!piece.activated` filter for handoff receivers.
- There is no fallback: if `passReceiverKeys` (or `handoffTargets`) ends
  up empty after the carrier's move, the UI is left in
  `isPassTargeting` / `isHandoffTargeting` limbo with the carrier's
  `activated` flag still `false`, allowing that piece to be reselected
  and moved again.

### Requirements

1. **Receiver eligibility fix (pass and handoff)**
   - Remove the `!piece.activated` condition from both the
     pass-receiver filter and the handoff-receiver filter, so any
     teammate (other than the carrier itself) within range/adjacency is
     a valid target regardless of whether they already completed a move
     this turn.
   - The receiver must still not already hold the ball (`hasBall: true`
     pieces cannot be receivers) and must be on the same team, not the
     carrier.
   - Catching a pass/handoff must not itself flip a receiver's
     `activated` flag to `true` as a side effect — only the carrier
     becomes `activated` when the play resolves. A receiver's existing
     `activated` state (from an earlier move this turn) is preserved
     unchanged.

2. **Auto-activate on zero valid targets (pass and handoff)**
   - After the carrier commits its move for a pass or handoff action,
     if the computed target set (`passReceiverKeys` / `handoffTargets`)
     is empty, the activation must end immediately instead of entering
     targeting mode:
     - Mark the carrier as `activated: true` at its final (moved)
       position.
     - Clear all pass/handoff pending/targeting state (`pendingPass`,
       `isPassTargeting`, `passRangeKeys`, `passReceiverKeys`,
       `pendingHandoff`, `isHandoffTargeting`, `handoffTargets`).
     - Do not set `passUsed: true` in this case — no pass/handoff roll
       occurred, so the team's pass/handoff resource for the turn is
       not consumed.
     - No pass/handoff action-log entries are added; only the move log
       entries already recorded for this activation remain.
   - This guarantees the piece cannot be reselected/moved again this
     turn, fixing the "moves the same player again" symptom, and is the
     authoritative fix — it must work even without item 3 below.

3. **Preemptive UX (secondary, best-effort)**
   - Where practical, disable/hide the "Pass" and "Hand Off" piece-menu
     actions up front if it's already knowable that no legal receiver
     exists from the carrier's current (pre-move) position. This is a
     UX nicety; requirement 2's auto-activate fallback remains
     authoritative and must still work if this step is skipped or
     imperfect (e.g. a receiver could become invalid due to the
     carrier's own movement path, which isn't known until move-time).

4. **Scope**
   - The fix lives in shared code (`client/src/useGameState.ts`) and
     applies to all game modes: Free Play and every puzzle scenario,
     not just `scenario-003` (long bomb).

5. **Testing**
   - Introduce Vitest as the test runner for the `client` package (no
     test framework currently exists in the repo).
     - Add `vitest` as a dev dependency in `client/package.json`
       (add `jsdom` only if a DOM environment turns out to be required
       — pure-logic tests on `useGameState`/`bfs` should not need it).
     - Add a `"test": "vitest run"` script to `client/package.json`.
     - Add a minimal `vitest.config.ts` (or a `test` block in the
       existing `vite.config.ts`) sufficient to run `.test.ts` files
       under `client/src`.
   - Add regression tests colocated with `useGameState.ts` (e.g.
     `client/src/useGameState.test.ts`) covering, at minimum:
     a. Reproduction of the reported bug: activate & move a catcher to
        end its activation, then activate the thrower, move it, declare
        Pass, and confirm the catcher IS present in `passReceiverKeys`
        (fails against current code, passes after the fix).
     b. Completing that pass to the already-activated catcher succeeds:
        ball transfers, thrower ends up `activated: true`,
        `passUsed: true`, and the thrower cannot be reselected
        afterward.
     c. Zero-valid-target case: construct a state where, after a
        carrier's move, no teammate is in pass range / adjacent for
        handoff; declare Pass (and separately Hand Off), commit the
        move, and assert the carrier is auto-activated
        (`activated: true`), targeting state is cleared, `passUsed`
        remains `false`, and the carrier cannot be reselected/moved
        again this turn.
     d. Equivalent handoff-specific version of (a)/(b): handing off to
        an already-activated adjacent teammate succeeds.
   - `npm run build`, `npm run lint`, and `npm run test` in `client/`
     must all pass (there is no hosted CI for this repo).

### Acceptance Criteria

- [ ] In the long bomb scenario (and generally, in any game mode):
      moving the catcher into the end zone first, then activating the
      thrower, moving it, and passing to the catcher, successfully
      completes the pass (or fails only due to an actual dice-roll
      failure per the pass/catch target numbers — never due to the
      catcher being ineligible).
- [ ] Handing off to an already-activated adjacent teammate works the
      same way.
- [ ] If a pass or handoff genuinely has no legal receiver after the
      carrier's move, the carrier's activation ends automatically
      (`activated: true`) and it cannot be moved again this turn;
      `passUsed` is not consumed.
- [ ] A receiver who catches a ball via pass or handoff does not become
      `activated` merely because it received the ball (its prior
      activation state, if any, is preserved).
- [ ] `client/src/useGameState.ts` no longer filters pass/handoff
      receiver candidates on `!piece.activated`.
- [ ] New Vitest suite exists, covering the four scenarios in
      Requirement 5, and `npm run test` passes in `client/`.
- [ ] `npm run build` and `npm run lint` in `client/` pass with no new
      errors/warnings.
- [ ] No regressions to existing pass/handoff/move behavior for the
      normal case (receiver not yet activated).

### Implementation Approach

1. **Set up Vitest** in `client/`: add `vitest` devDependency,
   `"test": "vitest run"` script, and a `vitest.config.ts` (or `test`
   block in `vite.config.ts`).
2. **Fix receiver eligibility** in `useGameState.ts`: remove
   `!piece.activated` from the pass-receiver filter (`pendingPass`
   branch) and the handoff-target filter (`pendingHandoff` branch).
3. **Add auto-activate-on-empty-targets fallback**: in the
   `pendingPass` branch, after computing `passReceiverKeys`, if it's
   empty, skip entering `isPassTargeting` and instead commit the
   carrier's move/activation via the existing "normal end-activation"
   path — reuse/extend the pattern the `pendingHandoff` branch already
   applies for its own empty-`targets` case (~line 289-292) rather than
   duplicating logic. Confirm the `pendingHandoff` branch's existing
   empty-target handling still behaves correctly with the eligibility
   fix applied.
4. **Write regression tests** (`client/src/useGameState.test.ts`)
   covering the four cases in Requirement 5.
5. **Verify**: run `npm run test`, `npm run lint`, and `npm run build`
   in `client/`; manually sanity-check via the dev server using the
   exact repro steps from the bug report on the long bomb scenario.
6. **Cleanup**: ensure only the intended diffs (`useGameState.ts`, new
   test file, `package.json`, `vitest.config.ts`) are part of the
   change.

---

## Agent Context Documentation Plan

### Problem Statement

New agent sessions currently need to rediscover too much of the repository by
reading source files, PR history, and prior specs. That burns tokens and time,
especially for repeated work in the same areas (`App.tsx`, scenario JSON,
leaderboards, auth, editor, Netlify functions).

The repository should provide a small, durable documentation layer that lets a
new agent quickly answer:

- What exists?
- Where should I make this type of change?
- What are the invariants I must not break?
- What commands prove the change is safe?
- What recent gotchas have already been learned?

### Requirements

1. **Keep `AGENTS.md` as the bootstrap**
   - `AGENTS.md` should stay short enough to read on every task.
   - It should contain repo layout, commands, hard rules, and links to deeper
     docs.
   - It should not become a full architecture manual.

2. **Add focused agent docs under a dedicated directory**
   - Recommended path:

     ```txt
     docs/agent-context/
     ```

   - Each file should cover one stable area of the system.
   - A new agent should be able to open only the relevant file for the task.

3. **Separate stable architecture from volatile plans**
   - Stable current-state docs belong in `docs/agent-context/`.
   - Feature plans and future implementation proposals can remain in
     `spec.md`.
   - Once a feature ships, the durable facts should be summarized in the
     relevant agent-context doc and the old plan should not be the primary
     source of truth.

4. **Document invariants, not every line of code**
   - Focus on things agents often need to rediscover:
     - data shapes,
     - routing,
     - persistence model,
     - user-visible flows,
     - important async consistency patterns,
     - admin/editor constraints,
     - validation rules,
     - production-vs-local differences.
   - Avoid restating implementation line-by-line.

5. **Make docs cheap to scan**
   - Use short headings and tables.
   - Prefer bullet lists and file references.
   - Include "When changing X, check Y" sections.
   - Keep each doc roughly 100-250 lines unless the domain truly needs more.

6. **Keep docs current as part of PR work**
   - Any PR changing one of the documented systems should update the relevant
     agent-context doc in the same PR.
   - If a doc is intentionally not updated, the PR description should say why.

### Recommended Documentation Structure

Create:

```txt
docs/agent-context/
  README.md
  frontend-flow.md
  game-rules-engine.md
  scenarios-and-series.md
  leaderboard-and-auth.md
  puzzle-editor.md
  netlify-deploy.md
  testing-and-pr-workflow.md
```

#### `README.md`

Purpose:

- Index of available context docs.
- A decision tree for which docs to read for common task types.

Suggested content:

```txt
If task touches home screen or app modes -> frontend-flow.md
If task touches movement/pass/handoff/dice -> game-rules-engine.md
If task touches scenario JSON or series -> scenarios-and-series.md
If task touches login/leaderboards -> leaderboard-and-auth.md
If task touches Admin Mode/editor -> puzzle-editor.md
If task touches Netlify/functions/deploy -> netlify-deploy.md
If task touches PRs/conflicts/checks -> testing-and-pr-workflow.md
```

#### `frontend-flow.md`

Capture:

- `AppMode` values and what renders for each.
- Identity gate behavior.
- User menu placement.
- Home screen Series/Individual switch.
- Editor preview return behavior.
- Common conflict area: `App.tsx`.

Must include:

- File references:
  - `client/src/App.tsx`
  - `client/src/ScenarioSelect.tsx`
  - `client/src/UserMenu.tsx`

#### `game-rules-engine.md`

Capture:

- Core coordinate system.
- Movement/reachable-square model.
- Pass and handoff targeting rules.
- Activation rules.
- Touchdown and probability logging.
- Known regression tests.

Must include:

- File references:
  - `client/src/useGameState.ts`
  - `client/src/bfs.ts`
  - `client/src/useGameState.test.ts`
  - `client/src/types.ts`

#### `scenarios-and-series.md`

Capture:

- Scenario JSON schema.
- `published` behavior.
- `ballPosition` vs `hasBall`.
- Scenario naming source of truth.
- Default series metadata and order.
- How normal players vs admins see disabled puzzles.

Must include:

- File references:
  - `client/src/scenarios/*.json`
  - `client/src/scenarios/index.ts`
  - `client/src/series/default.json`
  - `client/src/series/index.ts`

#### `leaderboard-and-auth.md`

Capture:

- Google Sign-In client flow.
- Server-side token verification.
- Guest identity persistence.
- Leaderboard entry auth fields.
- Netlify Blobs eventual-consistency submit pattern.
- Local vs production storage.

Must include:

- File references:
  - `client/src/AuthProvider.tsx`
  - `client/src/auth.ts`
  - `client/src/api.ts`
  - `server/auth.js`
  - `server/index.js`
  - `netlify/functions/auth.js`
  - `netlify/functions/leaderboard.js`
  - `netlify/functions/series-leaderboard.js`

#### `puzzle-editor.md`

Capture:

- What works locally.
- What does not yet work on deployed Netlify.
- Editor API endpoints.
- Palette templates and fixed stats.
- Save-over vs save-as-new behavior.
- Series assignment behavior.
- Editor preview return behavior.
- Loose-ball limitation in gameplay.

Must include:

- File references:
  - `client/src/editor/*`
  - `server/editor.js`
  - `client/src/App.tsx`

#### `netlify-deploy.md`

Capture:

- Existing `netlify.toml` build/redirects.
- Required environment variables.
- Google OAuth origin setup.
- What production functions exist today.
- What is needed for production puzzle editing.

Must include:

- File references:
  - `netlify.toml`
  - `netlify/functions/*`

#### `testing-and-pr-workflow.md`

Capture:

- Required commands:

  ```bash
  npm run build
  cd client && npm run lint
  cd client && npm test -- --run
  ```

- When tests are required.
- Common PR conflict patterns.
- How to continue rebases without `$EDITOR`.
- How to preserve unrelated local changes.

### `AGENTS.md` Changes

Once the context docs exist, update `AGENTS.md` to add a short section:

```md
## Agent Context Docs

Before broad source inspection, read the smallest matching doc in
`docs/agent-context/`.

- Home/app modes: `docs/agent-context/frontend-flow.md`
- Rules/movement/dice: `docs/agent-context/game-rules-engine.md`
- Scenarios/series: `docs/agent-context/scenarios-and-series.md`
- Auth/leaderboards: `docs/agent-context/leaderboard-and-auth.md`
- Puzzle editor/admin: `docs/agent-context/puzzle-editor.md`
- Netlify/deploy: `docs/agent-context/netlify-deploy.md`
- Checks/PR workflow: `docs/agent-context/testing-and-pr-workflow.md`
```

Move detailed sections that are now too long for `AGENTS.md` into the matching
context docs, leaving only pointers and critical hard rules in `AGENTS.md`.

### Constraints

- Documentation must not require an agent to read every file before starting.
- Docs must not duplicate entire source files.
- Docs must be kept factual and current; avoid speculative roadmap content
  except where clearly labeled as "future".
- Keep `spec.md` for plans, not as the long-term operational manual.
- Do not remove critical commands or hard repo rules from `AGENTS.md`.
- Do not store secrets or concrete personal tokens in docs.

### Architecture

Use a three-layer documentation model:

1. **Bootstrap layer**
   - `AGENTS.md`
   - Always read.
   - Contains repo rules, commands, and context-doc routing.

2. **Context layer**
   - `docs/agent-context/*.md`
   - Read selectively based on task.
   - Describes current shipped behavior and invariants.

3. **Planning layer**
   - `spec.md`
   - Used for new feature planning and implementation specs.
   - Not assumed to be current operational truth after a feature ships unless
     promoted into context docs.

### Implementation Steps

1. Create `docs/agent-context/README.md`.
   - Add the task-to-doc routing table.
   - Explain that docs are selective, not mandatory full reading.

2. Create the first three high-value docs:
   - `frontend-flow.md`
   - `scenarios-and-series.md`
   - `puzzle-editor.md`

3. Create support docs:
   - `leaderboard-and-auth.md`
   - `game-rules-engine.md`
   - `netlify-deploy.md`
   - `testing-and-pr-workflow.md`

4. Trim `AGENTS.md`.
   - Keep hard rules and setup.
   - Add links to context docs.
   - Move detailed explanatory sections into matching context docs.

5. Add a PR checklist item.
   - "If this changes documented behavior, update `docs/agent-context/*`."
   - If no PR template exists, document this in `testing-and-pr-workflow.md`.

6. Validate usefulness with a dry run.
   - Pick a sample task, e.g. "change leaderboard display".
   - Confirm a new agent can read only `AGENTS.md` +
     `leaderboard-and-auth.md` and know where to work and what checks to run.

### Success Criteria

- A new agent can identify the right files for common tasks without broad
  repository scanning.
- `AGENTS.md` stays short enough to read on every turn.
- Each major subsystem has a focused current-state context doc.
- Implementation plans in `spec.md` no longer need to be reread for shipped
  behavior.
- PRs that change documented behavior update the matching context docs.
- The documented verification commands match the repo's actual scripts.
- The docs explain production/local differences for auth, leaderboards,
  Netlify, and puzzle editing.
- Token usage for routine tasks should drop because agents can read one small
  context doc instead of repeatedly inspecting `App.tsx`, scenario loaders,
  server functions, and old specs.

---

# Loose Ball Pickup

## Problem Statement

The game only supports the ball while it is carried by a player
(`PlayerPiece.hasBall`). The `Scenario` schema and Puzzle Editor already let
an author place a **loose ball** on the pitch (`Scenario.ballPosition`), and
editor-side validation already enforces "carried XOR loose" — but nothing in
the runtime game (`useGameState`, `bfs`, `Pitch`) reads `ballPosition`, so an
authored loose-ball puzzle currently renders no ball at all and no player can
ever pick it up.

This spec adds runtime support for a loose ball: rendering it prominently on
its square, and letting a player pick it up by moving onto that square,
following this project's existing "always succeed, track the probability"
pattern (the same pattern already used for dodges and GFI rolls) rather than
a real pass/fail dice roll.

## Requirements

### Visual

- When `Scenario.ballPosition` is set, render a loose-ball icon on that
  square in `Pitch.tsx`, reusing the existing `BallIcon` SVG.
- The loose-ball icon must be visually larger than the current carried-ball
  marker (`.ball-marker`, currently 58% of the square) — large enough to
  read clearly as "the ball is here, unguarded" versus the smaller carried
  marker that sits over a player portrait. Target ~85–90% of the square.
- Once the ball is picked up, the loose marker disappears from that square
  and the normal carried `BallIcon` appears on the carrying piece, exactly
  as it does today for scenario-authored `hasBall` carriers.
- The editor's own loose-ball rendering (`editor-ball` in
  `PuzzleEditor.tsx`) is unaffected by this change — this task is about the
  play view (`Pitch.tsx`) only.

### Gameplay — pickup roll

- Moving a player's path onto the square containing the loose ball
  initiates a pickup check, using the standard Agility-test target already
  used for dodges elsewhere in `bfs.ts`:
  `target = clamp(6 - AG + tackleZoneCount, 2, 6)` where `tackleZoneCount`
  is the number of opposing tackle zones covering the ball's square (same
  computation `dodgeTargetAt` already does — a Human AG3 player needs 3+,
  an AG4 player needs 2+, matching the standard rule quoted in the request).
- **Per this project's established convention (confirmed with the user):**
  the pickup never actually fails the move. There is no turnover, no ball
  scatter, and no branching outcome. Instead, the pickup's success
  probability is computed and folded into the action log / cumulative
  probability exactly like a dodge or GFI step — i.e. picking up the ball
  is modeled as another risky step in the puzzle's overall probability, not
  as a real dice roll with a random result.
- A step that both requires a dodge (leaving a tackle zone) *and* lands on
  the loose ball's square requires both rolls; their probabilities multiply
  for that step, mirroring how dodge + GFI already stack today.
- Once a player's committed path includes the loose ball's square, that
  player becomes the ball carrier (`hasBall: true`) and the scenario's
  loose-ball position is cleared, at the same point where the game already
  finalizes piece position/state for a move (end of activation, or
  immediately for a same-click touchdown). The mid-move touchdown check
  (a piece reaching the end zone while carrying the ball) must correctly
  detect a piece that picks up the ball and reaches the end zone within the
  same committed path/click.
- Dice-log / action-log UI (`DiceLog.tsx`) should surface the pickup roll
  the same way it currently surfaces dodge rolls, so puzzle solvers can see
  the pickup target and its contribution to the overall probability.

### Non-goals (explicitly out of scope, per clarification)

- No real failure / turnover / ball-scatter mechanic — this task keeps the
  existing "never actually fail, just record probability" model used
  everywhere else in the game.
- No change to pass/handoff catch logic — failed catches do not produce a
  loose ball; this task is scoped to picking up an already-loose,
  scenario-authored ball only.
- No "Sure Hands" skill / re-roll support — there is no skill-effect
  infrastructure in the codebase yet; this is left for future work.
- No new way for the ball to *become* loose during play (e.g. dropped after
  a failed roll). The only source of a loose ball is
  `Scenario.ballPosition`, authored via the Puzzle Editor.
- No changes to the Free Play mode's fixed roster (`FREE_PLAY_PIECES` has
  no loose-ball concept and isn't scenario-driven).

## Acceptance Criteria

1. A scenario with `ballPosition` set (no piece has `hasBall: true`) shows
   a large, unmistakable loose-ball icon on that square when played.
2. Selecting a piece and moving its path across the loose ball's square
   causes that piece to end its activation carrying the ball
   (`hasBall: true`); the loose ball marker is gone from the board
   afterward, and the piece shows the normal carried-ball icon.
3. The action log shows a pickup entry (target number + probability) for
   the step that lands on the ball's square, and the puzzle's overall
   cumulative probability includes the pickup roll's chance of success.
4. A step that requires both a dodge and a pickup shows/multiplies both
   probabilities correctly.
5. A player who picks up the ball and reaches the end zone within the same
   move/click correctly triggers the touchdown phase (`phase: 'touchdown'`)
   — this must work even though the piece's `hasBall` flag was `false` at
   the start of that click.
6. Existing carried-ball scenarios, Free Play, pass, and handoff behavior
   are unchanged (no regressions) — verified via `useGameState.test.ts`
   plus manual smoke-test in the running app.
7. `cd client && npm run build` and `npm run lint` both pass.

## Implementation Approach

1. **Types** (`client/src/types.ts`)
   - Add `ballPosition: Position | null` to `GameState`.
   - Add an optional `pickupTarget: number | null` field to `MoveLogEntry`
     (mirroring `dodgeTarget`), defaulted to `null` for existing entries so
     `DiceLog`'s existing dodge/GFI rendering keeps working unchanged for
     non-pickup steps.

2. **Pathfinding** (`client/src/bfs.ts`)
   - Add a `pickupTargetAt(pos, ag, opponentPositions)` helper (same
     formula as `dodgeTargetAt`).
   - Extend `PathStep` with `pickupTarget: number | null`.
   - Extend `findShortestPath` (and any other path-building helper used for
     committing a move) to accept the current loose-ball `Position | null`
     and set `pickupTarget` on the step whose destination matches it.

3. **Game state** (`client/src/useGameState.ts`)
   - `makeScenarioState`: seed `ballPosition` from `scenario.ballPosition`.
   - Thread the loose-ball position into `findShortestPath`/hover-preview
     calls alongside the existing `ma`/opponents/others args.
   - In the move-commit step-processing loop, fold `pickupTarget` into the
     per-step probability (`stepProb *= pickupProb`) the same way `isGfi`
     and `dodgeTarget` already do, and populate the new `pickupTarget`
     field on the resulting `MoveLogEntry`.
   - Determine "will this activation end with this piece carrying the
     ball" by checking whether the loose ball's square appears anywhere in
     the piece's accumulated `walkedSquares` for the activation (not just
     the final destination) — use this in place of `piece.hasBall` for the
     same-click touchdown check.
   - At every point the game finalizes a piece's position for an
     activation (normal end-activation click, same-click touchdown click,
     and `handleEndTurn`'s trailing `commitMove`), if the ball was picked
     up during that activation: set `hasBall: true` on the piece and clear
     `state.ballPosition` to `null`.
   - Reset `ballPosition` appropriately in `clearSelection`/`advanceTurn`
     only if it should persist across turns (it should — a loose ball
     stays on the pitch until someone picks it up, so it must NOT be reset
     by `advanceTurn`).

4. **Rendering** (`client/src/Pitch.tsx`, `client/src/Pitch.css`)
   - Render the loose ball on `state.ballPosition`'s square using the
     existing `BallIcon`, in a new larger CSS class (e.g.
     `.ball-marker--loose`) sized to ~85-90% of the square instead of the
     carried marker's 58%.

5. **Tests**
   - Extend `client/src/useGameState.test.ts` with cases covering: picking
     up a loose ball via a plain move, a same-click touchdown after
     pickup, and a step requiring both dodge and pickup rolls.

6. **Verification**
   - Run `cd client && npm run lint` and `npm run build`.
   - Run the existing test suite (`npm run test` / vitest) to confirm no
     regressions.
   - Manually smoke-test a loose-ball puzzle via the dev server.

---

# Block and Blitz Actions

## Problem Statement

The game has no way to knock down an opponent. Every action implemented so
far (Move, Handoff, Pass) follows the same shape: **one Agility roll, one
target number, one outcome** — the game always assumes success and folds
that roll's probability into the running `cumulativeProb`, exactly like a
dodge or GFI step. A Block roll does not fit that shape:

- The number of dice rolled (1–3) depends on comparing the two players'
  Strength, and whenever one side has an advantage, **that side's coach
  chooses which of the rolled dice to use** — this is a discrete choice
  among several distinct dice, not a single probability.
- The die itself has **5 possible faces**, each a materially different
  outcome for how the board continues (attacker falls / both fall / one is
  pushed / one is pushed and falls), not a simple pass/fail.
- Depending on the puzzle, different subsets of those 5 outcomes may be
  "acceptable" — e.g. a puzzle might only care about a Push, might accept
  either Push or Pow, or might need a Pow specifically to clear a lane.

This spec defines how Block dice are modeled inside this project's
existing "always succeed, track the probability" architecture, and adds
the Block and Blitz actions to the PieceMenu.

## Rules Reference (BB2020/BB2025, via FFB source)

**Number of dice** — compare effective Strength (own ST + assists):
- Attacker ST > 2× Defender ST → **3 dice**, attacker picks
- Attacker ST > Defender ST → **2 dice**, attacker picks
- Attacker ST == Defender ST → **1 die**, no choice
- Defender ST > Attacker ST → **2 dice**, defender picks
- Defender ST > 2× Attacker ST → **3 dice**, defender picks

**Assists** — each adjacent teammate of the blocking player adds +1 to
that side's effective Strength for this comparison (both attacker and
defender count their own assists).

**The block die (6 faces, standard weighting)**:

| Face | Outcome | Effect |
|---|---|---|
| 1 | **Attacker Down** | Attacker falls down. |
| 2 | **Both Down** | Both players fall down, unless prevented by skill (see below). |
| 3–4 | **Push Back** | Defender is pushed one square away; nobody falls. |
| 5 | **Defender Stumbles** | Defender is pushed back and falls down (armor/injury roll follows in full rules), unless the defender has Dodge (downgrades to a plain Push) — unless the attacker also has Tackle (cancels the Dodge, so the defender falls anyway). |
| 6 | **Defender Down** | Defender is pushed back and falls down. Attacker may follow up into the vacated square. |

**Skills in scope for this pass**:
- **Block** — a player with this skill does not fall down themself on a
  Both Down result (checked independently for attacker and defender; if
  both have Block, neither falls).
- **Dodge** (defender) / **Tackle** (attacker) — interact only on the
  Defender Stumbles face, as described above.
- No other skills (Wrestle, Guard, Stand Firm, Frenzy, etc.) are in scope.

**Push Back / follow-up** — the defender moves one square directly away
from the attacker's square. There are up to 3 candidate squares (the
squares in the "away" arc); a square only qualifies if it's on the pitch
and unoccupied. The attacker's coach chooses the square (if more than one
qualifies) and separately chooses whether to follow up into the square the
defender vacated.

**Non-goals for this pass**:
- No Armor/Injury roll — a "fallen" player is simply marked `down: true`
  and stops contributing a tackle zone; no elimination/casualty modeling.
- No standing back up, no Rush/GFI-into-block interactions beyond what
  Blitz needs.
- No Wrestle, Guard, Stand Firm, Frenzy, Juggernaut, or other block-related
  skills.
- No Puzzle Editor changes — Block/Blitz scenarios are authored by hand in
  scenario JSON for this pass, same as the current process for any new
  scenario field.
- No crowd push / pitch-invasion / multi-block mechanics.

## Design: modeling block dice inside the probability-tracking model

Every other action in this codebase computes one target number and treats
that roll as "always succeeding," multiplying its chance into
`cumulativeProb`. Block breaks that because a single roll produces 5
qualitatively different outcomes, and puzzles may accept more than one of
them as "good enough to continue."

**Chosen approach — outcome checklist:**

1. When the player declares a Block/Blitz against a defender, the game
   computes dice count + picker (attacker or defender) from the ST
   comparison above, and shows the 5 possible outcomes with their
   individual probabilities (see combination formula below).
2. The player checks which outcome(s) they'd accept as the block
   "succeeding" for this puzzle (e.g. just Push Back, or Push Back + both
   Pow faces).
3. The combined probability of "the check(s) I made" is computed (see
   below) and folded into `cumulativeProb`, the same way every other
   roll's probability already is.
4. **If exactly one outcome is checked**, the game state simply resolves
   to that outcome directly (apply its board effects).
   **If more than one outcome is checked**, the player is asked one more
   small question — which of the checked outcomes to actually continue
   simulating from — before the game applies that outcome's board
   effects. (Only the checked-and-selected outcome's board effects are
   applied; the others only contributed to the probability number.)

This generalizes the existing single-target-number pattern to "a sum over
an accepted subset of discrete outcomes" instead of "a single Agility
target," while still never branching the actual game state — exactly one
canonical continuation is always chosen, same as today.

**Combined probability formula** (per face probability `p = checkedFaces/6`):
- **Attacker picks** (attacker has dice advantage, or 1 die): the attacker
  uses whichever rolled die is best for them, so the block "succeeds" if
  **any** of the dice show a checked face: `P = 1 - (1 - p)^diceCount`.
- **Defender picks** (defender has dice advantage): the defender uses
  whichever die is worst for the attacker, so the block only "succeeds"
  if **every** die shows a checked face: `P = p^diceCount`.
- `diceCount` is 1, 2, or 3 per the ST comparison table above.

**Dice-count/picker display**: the UI shows the combined odds only (no
per-die assignment) — consistent with how the rest of the game never
shows "which physical die," only the resulting chance.

## Requirements

### Data model (`client/src/types.ts`)

- Add `down: boolean` to `PlayerPiece` and `ScenarioPieceDef` (defaults to
  `false`). A `down` piece:
  - stops contributing a tackle zone (affects `dodgeTargetAt`,
    `pickupTargetAt`, `passTargetAt`, `catchTargetAt`, assist counts, and
    block dice-count comparisons — all existing tackle-zone-counting call
    sites must skip `down` pieces),
  - cannot be selected/activated this turn (or any future turn, until a
    stand-up mechanic exists — out of scope, so a `down` piece is
    effectively removed from further play for the puzzle),
  - is NOT removed from the board — it renders as fallen (visual detail in
    Rendering section).
- Add a new `BlockLogEntry` variant to `ActionLogEntry`:
  ```ts
  export type BlockOutcomeFace =
    | 'attacker-down' | 'both-down' | 'push' | 'defender-stumbles' | 'defender-down';

  export type BlockLogEntry = {
    kind: 'block';
    isBlitz: boolean;
    pieceName: string;         // attacker
    pieceRole: string;
    receiverName: string;      // defender (reuse receiver* fields for RiskyMove compat)
    receiverRole: string;
    from: Position;            // attacker position (post-move, if Blitz)
    to: Position;               // defender position
    diceCount: 1 | 2 | 3;
    picker: 'attacker' | 'defender';
    outcomeProbs: Record<BlockOutcomeFace, number>; // probability of each face occurring at least/only as required by picker
    acceptedFaces: BlockOutcomeFace[];  // faces the player checked
    resolvedFace: BlockOutcomeFace;     // the single face the game continues from
    actionProb: number;         // combined probability of acceptedFaces per the formula above
    cumulativeProb: number;
    dodgeTarget: null;
    isGfi: false;
  };
  ```
  (Mirrors `HandoffLogEntry`'s trick of carrying dummy `dodgeTarget: null,
  isGfi: false` fields so it flows through the existing risky-move filter
  in `App.tsx`'s `summarizeActionLog` unchanged.)
- Add `blockUsed` tracking to `GameState`: reuse the existing single-flag
  pattern but scoped correctly per the rules — `blitzUsed: boolean` (one
  Blitz per team turn, mirrors `passUsed`); ordinary Block has **no** turn
  limit (any number of eligible, unactivated pieces may each throw one
  Block this turn) so it needs no flag beyond each piece's own `activated`.
- Add pending-block state fields (mirroring `pendingHandoff`/
  `isHandoffTargeting`/`handoffTargets`):
  ```ts
  pendingBlock: boolean;         // declared Block/Blitz — move first (Blitz only) then pick target
  isBlockTargeting: boolean;     // choosing which adjacent opponent to block
  blockTargets: Set<string>;     // adjacent opposing squares eligible to block
  blockChoice: {                 // set once a defender is targeted, before resolving
    defenderId: string;
    diceCount: 1 | 2 | 3;
    picker: 'attacker' | 'defender';
    outcomeProbs: Record<BlockOutcomeFace, number>;
  } | null;
  ```
- Extend `RiskyMove` with the same optional Block fields
  (`diceCount?`, `picker?`, `acceptedFaces?`, `resolvedFace?`) so
  leaderboard/score-summary rows can render a Block entry.

### Rules engine (`client/src/bfs.ts`)

- Add `countAdjacentAssists(pos, teamPositions, excludeId)` — flat count of
  adjacent teammates (per the "flat adjacency count" decision — no
  exclusion for teammates who are themselves marked, no Guard doubling).
- Add `blockDiceCount(attackerSt, attackerAssists, defenderSt,
  defenderAssists): { diceCount: 1|2|3, picker: 'attacker'|'defender' }`
  implementing the ST comparison table above.
- Add `blockOutcomeProbabilities(diceCount, picker): Record<BlockOutcomeFace, number>`
  computing each face's combined probability using the attacker-picks /
  defender-picks formulas above (a face's own combined probability is
  computed by treating that single face as "checked" in isolation, so the
  UI can show all 5 individually **and** let the player sum a custom
  subset — the entry's stored `actionProb` for multiple checked faces is
  NOT simply the sum of the individual displayed values, since faces are
  not mutually exclusive across dice; recompute via the same
  any-die/all-dice formula against `p = (# checked faces)/6` for the
  actually-checked set, exactly as specified in the Design section).
- Update `dodgeTargetAt`, `pickupTargetAt`, `passTargetAt`, `catchTargetAt`,
  and `neighbours`/tackle-zone helpers to exclude pieces where `down ===
  true` from tackle-zone counts.
- Push-back squares: add `pushBackCandidates(attackerPos, defenderPos,
  allPiecePositions): Position[]` returning the up to 3 on-pitch,
  unoccupied squares directly away from the attacker (the "away" arc).

### Game state (`client/src/useGameState.ts`)

- `handleBlockAction(pieceId, isBlitz)` — entry point from PieceMenu,
  mirrors `handleHandoffAction`/`handlePassAction`: validates eligibility
  (piece not `activated`, not `down`; for Blitz also `!blitzUsed`), selects
  the piece, sets `pendingBlock: true` (and for Blitz, allows movement via
  the existing `reachableKeys` machinery already used for normal moves).
- On ending the (optional, Blitz-only) movement step with `pendingBlock`
  set: compute `blockTargets` = adjacent opposing, non-`down` pieces from
  the piece's final position, open `isBlockTargeting`. If zero targets,
  end the activation with no block thrown (mirrors the existing
  zero-targets fallback for Handoff/Pass).
- `handleBlockTarget(col, row)` — called when the player clicks a
  highlighted defender square during `isBlockTargeting`: computes
  `diceCount`/`picker`/`outcomeProbs`, populates `blockChoice`, and opens
  the outcome-checklist UI (no board mutation yet).
- `handleBlockOutcomeChoice(acceptedFaces: BlockOutcomeFace[],
  resolvedFace: BlockOutcomeFace)` — called once the player confirms their
  checklist (and, if >1 face checked, their chosen continuation face):
  computes `actionProb` per the combined formula, logs the `BlockLogEntry`,
  applies `resolvedFace`'s board effects:
  - `attacker-down`: attacker piece → `down: true`; attacker `activated: true`.
  - `both-down`: both → `down: true` unless each has the `'Block'` skill
    (checked independently); attacker `activated: true`.
  - `push`: defender moves to the chosen push-back square (see next
    bullet for the square-choice sub-step); attacker `activated: true`.
  - `defender-stumbles`: same as push, then defender additionally
    → `down: true`, unless defender has `'Dodge'` and attacker lacks
    `'Tackle'` (downgrade to plain push, no fall).
  - `defender-down`: same as `defender-stumbles`'s "always falls" case
    (push + `down: true`), then optionally follow up (see below).
  - Sets `blitzUsed: true` if this was a Blitz.
- Push-square + follow-up sub-step (triggered by `push`,
  `defender-stumbles`-that-falls, or `defender-down`): expose
  `pushTargetKeys: Set<string>` (from `pushBackCandidates`) and, once the
  player clicks one, expose a yes/no "Follow up?" choice (only offered on
  `defender-down`, per the real rules — plain Push/Stumble pushback does
  not offer follow-up since the attacker didn't cause a fall). Resolve via
  a `handlePushChoice(col, row, followUp: boolean)` action.
- Reset `blitzUsed`, `pendingBlock`, `isBlockTargeting`, `blockTargets`,
  `blockChoice`, `pushTargetKeys` in `advanceTurn`/`clearSelection`
  wherever the equivalent Handoff/Pass fields are already reset.

### UI (`client/src/PieceMenu.tsx`, `client/src/App.tsx`)

- Add `'block'` and `'blitz'` actions to `PieceMenu`'s checklist, disabled
  per: Block disabled if piece `activated`/`down` or has zero adjacent
  opposing targets; Blitz additionally disabled if `blitzUsed`. Block and
  Blitz are mutually exclusive with each other and with Pass/Handoff
  (extend `EXCLUSIVE_KEYS`); Blitz implies Move the same way Pass/Handoff
  do today (movement, if any, happens before the block is thrown).
- New `BlockOutcomePanel` component (new file, following the existing
  small-component convention like `PieceMenu`): renders the 5 outcome rows
  (face name + individual probability), a checkbox per row, and — only
  when >1 row is checked — a second "continue as" single-select among the
  checked rows. A Confirm button calls `handleBlockOutcomeChoice`.
- `Pitch.tsx`: highlight `blockTargets` during targeting (new
  `square--block-target` class, distinct from existing handoff/pass
  target highlight colors) and `pushTargetKeys` during the push-square
  sub-step; render `down` pieces with a distinct rotated/greyed piece
  style so solvers can see who's out of the play.

### Dice log (`client/src/DiceLog.tsx`)

- Add a `kind === 'block'` branch: label shows `"{attacker} ⚔ {defender}"`,
  a tag showing `"{diceCount}D {picker === 'attacker' ? 'Att' : 'Def'} pick"`,
  the resolved face's name, and the combined `actionProb` percentage —
  following the exact visual pattern already used for the `handoff`/`pass`
  branches (tag + percentage pill).
- `cumFraction`'s per-entry fraction math gets a `kind === 'block'` case
  using the entry's stored `actionProb` directly (already a clean
  probability in [0,1]; convert to a fraction the same way pickup/dodge
  entries already do via their target number, or store a precomputed
  `num`/`den` on the entry to avoid re-deriving a fraction from a
  non-1-in-6-shaped probability — implementer's choice, whichever keeps
  `cumFraction` simplest).

## Acceptance Criteria

1. A piece with an adjacent opposing, non-`down` piece can declare Block
   (no turn limit) or Blitz (once per team turn) from the PieceMenu.
2. Declaring Blitz allows movement (using the piece's MA) before the block
   is thrown; declaring plain Block does not move the piece.
3. Targeting a defender computes and displays all 5 outcome faces with
   individually correct probabilities, based on the ST/assist comparison
   (flat adjacency count) and correct attacker-picks/defender-picks dice
   math.
4. Checking one outcome and confirming resolves directly to that outcome's
   board effect (falls / pushes marked correctly, `down` flags set per the
   Block-skill and Dodge/Tackle interaction rules above) and logs a
   `BlockLogEntry` whose `actionProb` matches the displayed probability for
   that single face.
5. Checking two or more outcomes surfaces a second "continue as" choice;
   confirming applies only the chosen face's board effect, but the logged
   `actionProb` reflects the combined chance of "any of the checked faces"
   (attacker-picks) or "all dice show a checked face" (defender-picks) as
   appropriate.
6. A Push, Defender Stumbles (fails Dodge/beaten by Tackle), or Defender
   Down outcome lets the player choose among the valid push-back squares
   when more than one is open; Defender Down additionally offers a
   follow-up choice.
7. `down` pieces are excluded from all existing tackle-zone-counting logic
   (dodge/pickup/pass/catch targets and block ST/dice comparisons) and
   cannot be selected/activated.
8. The dice log renders a Block entry with the correct dice-count/picker
   tag, resolved outcome name, and probability, consistent with the visual
   style of existing Handoff/Pass entries.
9. `cd client && npm run build`, `npm run lint`, and the existing
   `useGameState.test.ts` suite all pass with no regressions.
10. New tests in `useGameState.test.ts` cover: 1-die even match, 2-dice
    attacker advantage, 2-dice defender advantage, a Both-Down resolution
    with one side having Block, a Defender-Stumbles downgraded by Dodge,
    a Defender-Stumbles restored to a fall by Tackle beating Dodge, a
    multi-face-checked combined probability, and a push-back square
    choice + follow-up.

## Implementation Approach

1. **Types** (`client/src/types.ts`) — add `down` to `PlayerPiece` /
   `ScenarioPieceDef`; add `BlockOutcomeFace`, `BlockLogEntry`; extend
   `ActionLogEntry`, `RiskyMove`; extend `GameState` with `blitzUsed`,
   `pendingBlock`, `isBlockTargeting`, `blockTargets`, `blockChoice`,
   `pushTargetKeys`.
2. **Rules math** (`client/src/bfs.ts`) — `countAdjacentAssists`,
   `blockDiceCount`, `blockOutcomeProbabilities`, `pushBackCandidates`;
   update all existing tackle-zone-counting helpers to skip `down` pieces.
3. **Game state** (`client/src/useGameState.ts`) — `handleBlockAction`,
   the pending-block branch inside the click-commit handler (mirroring the
   pendingPass/pendingHandoff branches), `handleBlockTarget`,
   `handleBlockOutcomeChoice`, `handlePushChoice`; reset new fields in
   `advanceTurn`/`clearSelection`.
4. **UI** — extend `PieceMenu.tsx`'s actions/exclusivity; new
   `BlockOutcomePanel.tsx`; wire both into `App.tsx`'s menu-action handler
   and square-click routing (same pattern as `isHandoffTargeting`/
   `isPassTargeting`); extend `Pitch.tsx`/`Pitch.css` for block/push
   target highlighting and the `down`-piece visual state.
5. **Dice log** (`client/src/DiceLog.tsx`) — add the `block` entry
   rendering branch and extend `cumFraction`.
6. **Tests** (`client/src/useGameState.test.ts`) — add the scenarios listed
   in Acceptance Criteria #10.
7. **Verification** — `cd client && npm run lint && npm run build && npm run test`.

---

# BB Tactics — Tabletop Playbook Home Redesign

## Status

Implementation-ready specification for the first visual redesign pass.

Decisions supplied by the product owner:

- Visual direction: **tabletop playbook**
- First-pass scope: **home screen first**
- Asset strategy: **CSS plus lightweight assets**

## Objective

Replace the current generic dark utility styling on the player-entry experience with a distinctive, tactile fantasy-football coaching-board presentation. The result should feel like a playbook laid on a coach's table: dark pitch felt, warm paper and card surfaces, chalk route marks, stamped labels, and compact tactical notation.

The redesign must improve personality, hierarchy, and perceived polish without changing how users authenticate, choose a mode, view progress, start a scenario or series, open rankings, or enter Admin Mode.

## Scope

### Included

- The identity gate shown before a Google or guest identity is ready.
- The signed-in home screen rendered by `ScenarioSelect`:
  - BB Tactics brand/header area.
  - Series/Individual mode switch.
  - Featured series presentation.
  - Individual challenge list/cards.
  - Progress, best score, rank, and ranked-player metadata.
  - Play, Start Series, and Rankings actions.
  - Admin Mode entry when the existing authorization visibility check passes.
- The `UserMenu` as it appears on the home screen, including its trigger and dropdown.
- Home-only responsive behavior, interaction states, focus states, and reduced-motion behavior.
- A small set of original, lightweight decorative assets if CSS alone is insufficient.

### Excluded

- Game HUD, pitch, pieces, movement overlays, dice log, player panel, piece menu, and phase UI.
- Individual and series leaderboard screens.
- Score summaries and submission, confirmation, or phase modals.
- Puzzle editor/Admin Mode content beyond retaining its existing entry button.
- Scenario names, descriptions, order, puzzle rules, game state, scoring, authentication logic, API calls, leaderboard behavior, or backend changes.
- A site-wide design-system migration. This pass may establish reusable tokens, but must not visually restyle out-of-scope screens.
- New character illustrations, stadium paintings, licensed Blood Bowl imagery, or large raster backgrounds.
- Light mode or a user-selectable theme.

## Experience Principles

1. **A coach's working playbook, not a costume.** Tactical markings and physical materials should support hierarchy and interaction. Avoid excessive torn edges, distressed text, fake stains, or effects that reduce clarity.
2. **Game information remains primary.** Scenario titles, descriptions, progress, and actions must be easier to scan than the decorative layer.
3. **One visual language.** Identity gate, Series, Individual, and home user menu should look like parts of the same tabletop kit.
4. **Original and lightweight.** Use CSS gradients, borders, shadows, pseudo-elements, and small original SVGs. Do not use third-party game art or copy protected brand assets.
5. **Responsive by composition.** The mobile layout should intentionally reorganize the playbook rather than merely shrink the desktop screen.

## Visual Direction

### Material and atmosphere

- The viewport resembles a dark green-black pitch felt or painted coach's table.
- Use layered CSS gradients and a very subtle noise/texture asset to prevent a flat digital background. Texture must not impair text contrast or create visible repetition.
- Main content surfaces resemble warm off-white playbook paper and muted charcoal clipboards, with restrained seams, rules, tape, or pin details.
- Chalk route lines, arrows, crosses, and formation dots may appear as low-contrast decoration in unused background space. They must be `aria-hidden`, non-interactive, and must not overlap readable content.
- Team-blue and opposition-rust may appear as secondary markings. A warm amber/gold is the primary action and progress accent.

### Color tokens

Implement home-scoped custom properties using the following target palette. Small adjustments are allowed during implementation to meet contrast requirements.

| Token | Target | Use |
|---|---:|---|
| `--home-felt-950` | `#101915` | Viewport base |
| `--home-felt-900` | `#17251d` | Felt gradient/highlight |
| `--home-felt-700` | `#2f4a38` | Quiet rules and chalk tint |
| `--home-ink-950` | `#171713` | Primary ink on paper |
| `--home-ink-700` | `#4f4b40` | Secondary ink |
| `--home-paper-100` | `#f1e8cf` | Primary paper surface |
| `--home-paper-200` | `#dfd2b3` | Paper edge/secondary surface |
| `--home-charcoal-900` | `#242621` | Dark cards and menu surfaces |
| `--home-chalk-100` | `#f6f1df` | Text on felt/charcoal |
| `--home-gold-500` | `#d7a63b` | Primary actions and progress |
| `--home-gold-600` | `#b88322` | Primary hover/pressed state |
| `--home-blue-500` | `#477da5` | Human-team tactical marks |
| `--home-rust-500` | `#a8533e` | Opposition tactical marks |
| `--home-danger-500` | `#bd5548` | Destructive/error state only |

Do not communicate progress, selection, or button hierarchy through color alone.

### Typography

- Use a sturdy slab-serif/display face for the BB Tactics wordmark and major playbook headings, paired with the existing system sans-serif stack for body copy and controls.
- Prefer one locally served, open-licensed variable WOFF2 display font plus its license file; target total added font weight under 150 KB. If that cannot be met cleanly, use a robust slab-serif system fallback rather than loading a remote font.
- Use uppercase condensed/stamped styling only for short labels and eyebrows. Body descriptions stay sentence case.
- Use tabular numerals for ranks, percentages, and leaderboard-count metadata.
- Avoid script fonts and heavily distressed fonts.

### Shape, depth, and motion

- Paper/card corners should be subtly imperfect through layered borders, clipped pseudo-elements, or tiny rotations of decorative layers—not by rotating interactive content or text.
- Use crisp 1–2 px rules, shallow elevation, and a limited shadow scale. Avoid glassmorphism, neon glows, and large soft gradients on cards.
- Hover may lift a selectable card or button by at most 2 px and strengthen its border/shadow.
- Pressed state must visibly settle back to the surface.
- Transitions should be 120–200 ms and limited to transform, color, border, and shadow.
- Under `prefers-reduced-motion: reduce`, remove transforms and nonessential transitions.

## Information Architecture and Screen Requirements

### Shared home shell

- Add a home-specific visual shell around the identity gate and signed-in home content.
- The shell owns the felt background, ambient chalk diagram layer, content width, top spacing, and responsive gutters.
- Decorative layers must not capture pointer events or introduce horizontal scrolling.
- The shell may be a small React component or scoped wrapper classes in `App.tsx`; it must not alter application routing or state.
- Desktop content width target: 960–1080 px. Maintain at least 20 px viewport gutter; use 12–16 px on narrow mobile screens.

### Identity gate

- Present the gate as a centered coach's registration card/clipboard on the felt surface.
- Include the BB Tactics wordmark and a short tactical descriptor such as “Coach's Playbook”; final copy may be refined but must not imply new functionality.
- Preserve exactly these behaviors:
  - Google sign-in remains disabled and labelled unavailable when auth is not configured.
  - The signing-in state continues to prevent duplicate submission.
  - “Play As Guest” reveals the existing guest-name field.
  - Guest names remain trimmed, limited to 32 characters, Enter submits, and Continue remains disabled for blank input.
  - Existing silent/cached Google authentication behavior is unchanged.
- When guest mode expands, it should appear as a ruled section of the same card rather than a visually unrelated form.
- On phones, actions stack and all controls are at least 44 px tall.
- Input and button focus states must be conspicuous against the paper/card surface.

### Signed-in home header

- Replace the plain text heading area with a compact playbook masthead:
  - BB Tactics is the dominant heading.
  - Existing explanatory copy remains visible, though it may be lightly edited for tone without changing meaning.
  - A quiet tactical badge/eyebrow identifies the page as the coach's board or challenge desk.
- Integrate the home `UserMenu` into the masthead layout on desktop instead of visually floating without context.
- On mobile, retain easy access to the user menu without allowing it to overlap the title or content. The trigger may show the avatar plus a shortened/hidden name where space requires it.
- Do not change the `UserMenu` identity, sign-out, or dropdown behavior.

### Series/Individual switch

- Restyle the mode switch as two playbook index tabs or clipboard dividers.
- Preserve native button semantics plus the current `tablist`, `tab`, and `aria-selected` attributes.
- Selected, hover, focus-visible, and pressed states must be distinct.
- The selected state needs a shape or marker in addition to color.
- Switching tabs must not reset fetched progress or introduce animation that delays content.

### Featured series

- Present the series as the primary “featured playbook” with stronger hierarchy than individual challenge cards.
- Retain the existing series name and description from runtime/static data as the source of truth.
- Surface the existing progress summary as a compact stamp or record strip.
- “Start Series” is the primary action; “Rankings” is secondary.
- No whole-card click target should be added unless it has a single unambiguous destination. Existing explicit buttons remain the authoritative controls.

### Individual challenges

- Present each scenario as a numbered play card or formation sheet.
- Scenario order in the loaded `scenarios` array determines any displayed play number; do not persist or infer a separate number.
- Scenario `name` and `description` remain the only title/copy source. Do not introduce a screen-specific override map.
- Keep the existing progress states and wording:
  - Loading/checking history.
  - Not played, with optional ranked count.
  - Best percentage and rank for played challenges.
- “Play” remains primary and “Rankings” secondary on every card.
- The grid may use two columns at wide widths and one column on narrow widths. Cards in a row should align their action areas without forcing descriptions to truncate.
- Do not hide progress or descriptions to achieve a denser layout.

### Admin entry

- Preserve the existing `isAdmin` conditional exactly as the visibility authority for the home button.
- Style Admin Mode as a quiet utility action separated from player actions.
- Do not add security logic or imply that client-side visibility is an authorization boundary.

### Home user menu

- Align trigger and dropdown surfaces with the tabletop system while maintaining strong contrast.
- Preserve avatar image behavior, initials fallback, displayed name, dropdown positioning, and sign-out action.
- The dropdown must remain above decorative and content layers and within the viewport at supported widths.
- Click, keyboard, focus, and outside-click behavior must remain unchanged.

## Component and Styling Architecture

### React changes

Expected changes are limited to presentational structure and classes in:

- `client/src/App.tsx` for the `IdentityGate` markup and the home-shell/masthead relationship.
- `client/src/ScenarioSelect.tsx` for playbook-oriented structural wrappers, decorative elements, and stable scenario numbering.
- `client/src/UserMenu.tsx` only if an additional class or nonsemantic decorative element is required.

Do not change component callbacks, data fetching, state ownership, authentication behavior, or mode transitions.

### CSS changes

- Keep the implementation in existing component stylesheets unless a small `HomeTheme.css` is demonstrably clearer.
- Scope all new tokens and selectors beneath `.app--home`, `.home-shell`, `.identity-gate`, or `.scenario-select`.
- Existing generic `.btn` rules currently serve more than the home experience. Do not globally redefine them in a way that restyles gameplay, editor, leaderboards, or modals. Add home-scoped variants/overrides or introduce narrowly named classes.
- Keep the global box reset and base font/background behavior stable unless a change is proven not to affect excluded screens.
- Favor CSS pseudo-elements for tape, chalk, pins, rules, and card layering. Decorative pseudo-elements must remain behind content.
- Avoid CSS features without broad modern browser support unless a readable fallback exists.

### Lightweight assets

Allowed additions:

- Up to three original SVG assets for texture or repeated tactical marks.
- One locally hosted open-licensed variable display font and its license, subject to the size target above.
- Total new compressed asset budget: 250 KB, excluding source-map/build output.

Asset requirements:

- Assets live under `client/src/assets/home/` (fonts may use `client/src/assets/fonts/`).
- SVGs must be optimized, contain no scripts or external references, and use original generic football/tactical motifs.
- Texture assets should tile cleanly and remain subtle at 1x and 2x device scale.
- Do not reuse `client/src/assets/hero.png`; it is generic, visually inconsistent with this direction, and not part of the redesign.
- No remote image or font runtime dependencies.

## Responsive Requirements

Support these layout bands, without hard-coding content to a single device:

- **Wide desktop (≥ 1024 px):** centered playbook workspace, featured series uses available horizontal space, two-column challenge grid, user menu incorporated in masthead.
- **Tablet/small desktop (641–1023 px):** maintain readable two-column challenges where card width permits; series actions may wrap; no overlap with user menu.
- **Mobile (≤ 640 px):** single-column cards, stacked identity actions, full-width primary actions where useful, compact masthead, and touch targets at least 44 × 44 px.
- Verify at approximately 1440 × 900, 1024 × 768, 768 × 1024, 390 × 844, and 320 × 568.
- No horizontal page scroll at any verification size with typical content and a 32-character guest/user name.

## Accessibility Requirements

- Meet WCAG 2.2 AA contrast: at least 4.5:1 for normal text and 3:1 for large text and meaningful UI boundaries/states.
- Preserve semantic heading order, labels, button elements, tab roles, and `aria-selected` behavior.
- Every interactive element must have a visible `:focus-visible` style that does not rely only on color.
- Touch/click targets should be at least 44 × 44 px on mobile.
- Decorative graphics must be ignored by assistive technology.
- Content remains usable at 200% browser zoom and with long scenario descriptions.
- Reduced-motion users receive no lift/rotation motion.
- Do not place essential text inside raster or SVG artwork.

## Performance and Compatibility Constraints

- Do not add a component library, CSS framework, icon library, animation library, or runtime theming dependency.
- Do not add network requests beyond the app's existing authentication, scenarios, and leaderboard calls.
- Added home assets must obey the 250 KB compressed budget.
- Avoid large blur filters and continuously animated texture/effect layers.
- Maintain compatibility with current Vite, React, TypeScript, and ESLint configuration.
- Do not leave unused imports, variables, props, or assets; TypeScript treats them as build errors.

## Implementation Steps

1. **Establish the scoped home theme.** Add the home-only color, type, spacing, border, and shadow tokens. Build the felt background and non-interactive chalk-diagram layer with CSS and, only if needed, one optimized tiling SVG.
2. **Refine the home structure.** Add a small home shell/masthead structure in `App.tsx` and `ScenarioSelect.tsx` that can place brand, copy, user menu, switch, and content without changing callbacks or app modes.
3. **Redesign the identity gate.** Apply the clipboard/registration-card treatment, retain all Google/guest states, and add responsive and focus behavior.
4. **Redesign scenario selection.** Implement playbook tabs, the featured-series sheet, numbered individual play cards, progress stamps, action hierarchy, and the quiet Admin Mode entry.
5. **Align the home user menu.** Update home-only trigger/dropdown styling and positioning while preserving behavior and keeping non-home menu usage visually unchanged.
6. **Add and audit lightweight assets.** Add only the approved original SVG/font assets that materially improve the result, include font licensing, optimize files, and confirm the asset budget.
7. **Verify behavior and quality.** Exercise identity and guest flows, both selection tabs, every action, progress states, admin visibility, the dropdown, responsive sizes, keyboard focus, reduced motion, zoom, and overflow.
8. **Run repository checks.** From `client/`, run `npm run test`, `npm run build`, and `npm run lint`. Inspect the final home experience in a real browser at desktop and mobile widths and check for console errors.
9. **Update durable context after implementation.** Once the redesign ships, record the resulting home-screen structure and visual behavior in `docs/agent-context/frontend-flow.md`; keep this spec as the implementation decision record.

## Verification Scenarios

### Identity

- Google auth configured: Log In With Google is enabled and signing-in protection remains.
- Google auth unavailable: the unavailable label and disabled state are legible.
- Guest mode closed and open.
- Empty, whitespace-only, normal, and 32-character guest names.
- Enter-key and Continue-button submission.

### Home and data states

- Series tab selected on entry.
- Individual tab with all currently published scenarios.
- Progress still loading, no scores, and played/ranked scores.
- Runtime scenario fetch succeeds and fails back to static scenarios.
- Admin user and non-admin/guest user.
- Google avatar and initials fallback; short and long display names.

### Interaction and layout

- Keyboard-only traversal through user menu, tabs, cards, and actions.
- Hover, focus-visible, pressed, disabled, and selected states.
- Reduced-motion preference.
- 200% browser zoom.
- The five target viewport sizes listed above.
- No visual changes on at least one gameplay screen and one leaderboard screen, confirming style isolation.

## Success Criteria

The redesign is complete when all of the following are true:

1. The identity gate and signed-in home screen clearly read as a cohesive tabletop playbook/coach's board rather than a generic dark dashboard.
2. Visual hierarchy makes the brand, mode choice, featured series or challenge title, progress, and primary Play action understandable at a glance.
3. Identity, authentication, scenario loading, progress fetching, Series/Individual switching, navigation callbacks, user-menu behavior, and Admin visibility behave exactly as before.
4. Scenario names and descriptions still come directly from loaded scenario data, and the series name/description still come directly from series data.
5. The redesign is isolated to the identity gate and home experience; gameplay, leaderboards, score UI, and editor content do not acquire accidental home-theme styling.
6. Desktop, tablet, and mobile layouts meet the responsive requirements with no overlap, clipped controls, unreadable copy, or horizontal scrolling.
7. Keyboard focus, semantic tabs, labels, reduced motion, contrast, target sizing, and 200% zoom meet the accessibility requirements.
8. No new runtime dependency or remote asset request is introduced; new assets remain within the 250 KB budget and comply with originality/licensing requirements.
9. `npm run test`, `npm run build`, and `npm run lint` all pass in `client/`.
10. Browser inspection at desktop and mobile widths shows no new console errors and confirms all verification scenarios relevant to available local configuration.

## Non-goals and Follow-up

The first pass established the visual language on the home experience. Phase 2 below extends the motifs that remain legible under dense tactical gameplay to the rest of the player-facing game; the editor remains separately scoped.

## Phase 2 — Player-Facing Visual Extension

The tabletop playbook system is extended through the rest of the player-facing
game while preserving all rules, data, authentication, and navigation behavior.

### Included

- Gameplay HUD, score/probability display, action legend, pitch frame and field
  palette, player card, action log, piece menu, and block outcome choices.
- Touchdown, phase, and confirmation modals.
- Individual and series leaderboards plus their score/run summaries.
- Desktop and mobile presentation, focus states, reduced motion, contained
  table overflow, and existing user-menu placements.

### Constraints

- The implementation uses a late-loaded, `app--playbook`-scoped CSS layer; it
  does not alter game-state or API logic.
- `app--game` and `app--archive` provide surface-specific layout hooks.
- Admin Mode and the puzzle editor remain outside this phase.
- No runtime dependency, remote font, or new image request is introduced.
- Dense game information remains readable and tactical overlay colors retain
  distinct meanings.

### Success Criteria

1. Gameplay, menus, modals, rankings, and summaries visibly belong to the same
   tabletop playbook system as the home screen.
2. The pitch and overlay states remain easy to read and player pieces retain
   clear team, selected, activated, carrier, and down states.
3. Existing game rules, score submission, leaderboard loading, navigation,
   authentication, and Admin Mode behavior remain unchanged.
4. Player-facing pages do not overflow horizontally at 390 px; dense tables
   provide an internal horizontal scroll area where needed.
5. Admin Mode does not inherit the player-facing theme.
6. Tests, production build, and lint pass with no new browser console errors.
