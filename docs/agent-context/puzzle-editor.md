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

Admin Mode renders `PuzzleEditor`.

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

### Guards

- **Unsaved-changes guard.** Opening another puzzle, starting a new one,
  reloading, or leaving the editor asks before discarding edits, and a
  `beforeunload` handler covers tab close. Previously all of these discarded
  silently.
- **Publish confirmation.** Publish is the one irreversible, player-facing
  action, so it asks first.
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

These write local JSON files under:

- `client/src/scenarios/`
- `client/src/series/default.json`

Deleting a scenario also removes its id from `client/src/series/default.json`.

## Production Editor

Netlify production persists editor drafts in Netlify Blobs:

- `netlify/functions/editor-scenarios.js` handles scenario draft create/update/delete.
- `netlify/functions/editor-series.js` handles the default draft series.
- `netlify/functions/editor-publish.js` copies draft scenarios/series to the published keys.
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

## Validation

Client and server share `shared/scenarioValidation.js`, so the editor's live
error list is exactly what the server will enforce. The client previously had
its own looser validator (no stat ranges, no team checks), which meant a
designer could see a clean list and still get a 400 on save.

## Auth

Every `/api/editor/*` route is admin-gated, **including the GET** — drafts
contain unpublished puzzles. `editorApi.fetchEditorData` therefore sends the
`Authorization` header too. On Netlify, a missing `ADMIN_EMAILS` means 503, not
an open editor; locally it defaults open so the editor works without OAuth.
