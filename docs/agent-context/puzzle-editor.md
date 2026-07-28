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

Local editor features:

- list all scenarios, including disabled ones,
- create a new puzzle,
- duplicate current puzzle,
- drag fixed Human/Orc player templates onto the editor pitch,
- auto-generate Blood Bowl style player names,
- override player names in inspector,
- move/delete players,
- place ball on a player or loose on the ground,
- save over existing puzzle,
- save as new puzzle,
- publish/disable puzzles,
- add/remove/reorder puzzle in default series,
- play draft and return to designer.

## Local Save API

`server/editor.js` registers:

- `GET /api/editor/scenarios`
- `POST /api/editor/scenarios`
- `PUT /api/editor/scenarios/:scenarioId`
- `PUT /api/editor/series/default`

These write local JSON files under:

- `client/src/scenarios/`
- `client/src/series/default.json`

## Production Limitation

Netlify production does not yet persist editor changes. The deployed app can
play built static scenarios, but editor saves require local Express.

For production editing later:

- add protected Netlify editor functions,
- store scenarios/series in Netlify Blobs or another backend,
- gate writes by verified Google `sub`, not display name.

## Pitch Orientation

Editor pitch uses scenario data orientation directly:

- 15 columns across,
- 26 rows down,
- end zones top and bottom.

Gameplay pitch rendering is separate and visually landscape.

## Fixed Templates

Stats come from `playerTemplates.ts`. The editor does not allow stat editing in
the inspector. Add new player types by adding templates, not by changing saved
scenario pieces manually.

