# Puzzle Editor

Primary files:

- `client/src/editor/PuzzleEditor.tsx`
- `client/src/editor/PuzzleEditor.css`
- `client/src/editor/playerTemplates.ts`
- `client/src/editor/editorApi.ts`
- `client/src/editor/editorValidation.ts`
- `server/editor.js`
- `client/src/App.tsx`

## What Works Now

Admin Mode renders `PuzzleEditor` with two sections: **Puzzle Editor** and
**Statistics**. Switching away from an unsaved puzzle is covered by the same
discard confirmation as other editor navigation.

Editor features:

- list all scenarios (including disabled ones) with description, active team,
  piece count, enabled state, and series position,
- create, duplicate, and delete puzzles,
- drag Human/Orc player templates onto the editor pitch,
- auto-generate Blood Bowl style player names,
- **full piece inspector**: name, id, team, role, MA/ST/AG/PA/AV as bounded
  numeric inputs, comma-separated skills, has-ball, delete,
- move players by drag,
- place ball on a player or loose on the ground,
- save over existing / save as new,
- enable/disable puzzles for players,
- publish draft changes (behind a confirmation),
- add/remove/reorder puzzle in default series, with a warning + one-click fix
  for series entries pointing at deleted puzzles,
- play draft and return to designer.

The Statistics section shows anonymous player-performance aggregates from the
full retained leaderboard data:

- unique recorded players, deduplicated by verified user id or guest name,
- retained puzzle and series personal-best counts,
- average, median, and best success probability,
- average dice count and latest score date,
- a per-puzzle breakdown plus a full-series summary.

Leaderboard storage keeps one personal best per player, not every attempt, so
these figures are explicitly labeled as personal-best statistics. They cannot
represent total attempts or completion rates. The API never returns player
names, ids, or move histories to the dashboard.

### Guards

- **Unsaved-changes guard.** Opening another puzzle, starting a new one,
  reloading, or leaving the editor asks before discarding edits, and a
  `beforeunload` handler covers tab close. Previously all of these discarded
  silently.
- **Publish confirmation.** Publish is the one irreversible, player-facing
  action, so it asks first.
- **Publish is blocked while the open draft has unsaved edits.** `Publish
  Drafts` only copies what the server already has in its draft store — it has
  no idea about in-progress edits still sitting in client state. Toggling
  "Enabled for players" (or any other field) and clicking Publish without an
  intervening Save silently published the *previous* saved state, so a puzzle
  an admin believed they'd just enabled stayed `published: false` and never
  appeared on Single Plays. The "Publish Drafts" button is now disabled
  whenever `hasUnsavedChanges` is true, forcing Save first.
- **Piece ids commit on blur**, not per keystroke — editing them live meant every
  intermediate value (including the empty string) briefly became the real id.

## Local Save API

`server/editor.js` registers (all admin-gated):

- `GET /api/editor/scenarios`
- `POST /api/editor/scenarios`
- `PUT /api/editor/scenarios/:scenarioId`
- `DELETE /api/editor/scenarios/:scenarioId`
- `PUT /api/editor/series/default`
- `POST /api/editor/publish`
- `GET /api/editor/statistics`

These write local JSON files under:

- `client/src/scenarios/`
- `client/src/series/default.json`

Deleting a scenario also removes its id from `client/src/series/default.json`.

## Production Editor

Netlify production persists editor drafts in Netlify Blobs:

- `netlify/functions/editor-scenarios.js` handles scenario draft create/update/delete.
- `netlify/functions/editor-series.js` handles the default draft series.
- `netlify/functions/editor-publish.js` copies draft scenarios/series to the published keys.
- `netlify/functions/editor-statistics.js` reads the full leaderboard Blobs and
  returns anonymous aggregates built by `shared/statistics.js`.
- `netlify/functions/scenarios.js` serves published scenarios/series to players.

Draft saves are not player-visible until an admin clicks Publish Drafts.
Deleting a draft scenario also removes it from the draft series; publishing is
still required before players see that deletion.

## Pitch Orientation

Editor pitch uses scenario data orientation directly:

- 15 columns across,
- 26 rows down,
- end zones top and bottom.

Gameplay pitch rendering is separate and visually landscape.

## Templates and Stats

`playerTemplates.ts` supplies the starting stats when a template is dragged onto
the pitch. Those values are then **editable per piece** in the inspector, within
the 1–12 range enforced by `shared/scenarioValidation.js`.

Add a genuinely new player type by adding a template — that keeps the palette
useful — rather than always hand-tuning stats after the fact.

The palette is exactly the BB2025 Human and Orc rosters
(https://bbtactics.com/human-teams/, https://bbtactics.com/orc-teams/):
Lineman, Catcher, Thrower, Blitzer, Halfling Hopeful, and Ogre for Humans;
Lineman, Thrower, Blitzer, Big Un Blocker, Goblin Lineman, and Troll for Orcs.

The generic "Orc Blocker" template was removed — BB2025 has no such position,
the Big Un Blocker replaces it. The `blocker` role itself is still in the role
dropdown and both portrait maps, alongside `guard`, `tackle`, `black-orc`, and
Orc `catcher`, in case an old draft still carries one.

Templates only seed *new* pieces — pieces already in `client/src/scenarios/*.json`
carry their own stored stats, so correcting a template does not retro-fit a
saved puzzle. The five shipped scenarios were migrated to BB2025 in a one-off
pass: generic Orc Blockers became Orc Linemen (Big Un is 0-2, so 4-per-team
Blockers could not legally become Big Uns), one mis-roled MA 6 "Blocker" with
Block became an Orc Blitzer, Human Catchers went ST 2 → 3 / AG 2+ → 3+ / PA 5+ →
4+, and Human Throwers traded `Block` for `Pass, Sure Hands`. That last one is
the only change with engine teeth — Throwers now fall on a Both Down.

Stored stats are **engine values, not printed rulebook values** — see the
comment at the top of `playerTemplates.ts`. In short: `ag` is `6 - printedTarget`
(AG 3+ → 3) because `bfs.ts` rolls `6 - ag`, `pa` is the printed target used
as-is, and `av` is the printed target minus 1 and is display-only.

Templates may carry a `names` pool, used by `generatedPlayerName` instead of the
team-wide pool — Halflings, Ogres, Goblins, and Trolls each have their own.

`ogre` and `troll` have dedicated gritty portrait art. `big-un` and `black-orc`
use the same text-free circular portrait style rather than the older cartoon
badges. `halfling` and `goblin` still have no portrait art, so
`playerPortraits.ts` falls back to the team default for those roles. Skills
beyond Block/Wrestle/Dodge/Tackle are display-only labels; the rules engine does
not implement them.

## Validation

Client and server share `shared/scenarioValidation.js`, so the editor's live
error list is exactly what the server will enforce. The client previously had
its own looser validator (no stat ranges, no team checks), which meant a
designer could see a clean list and still get a 400 on save.

## Auth

Every `/api/editor/*` route is admin-gated, **including both GET endpoints** —
drafts contain unpublished puzzles and statistics summarize the full untrimmed
leaderboards. Editor API reads therefore send the `Authorization` header too.
When `ADMIN_EMAILS` is empty, access is unrestricted in both local development
and Netlify. A configured allowlist requires a verified matching Google user.
Set `EDITOR_ALLOW_UNAUTHENTICATED=false` to make an empty allowlist return 503.
