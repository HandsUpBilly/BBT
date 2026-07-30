# Frontend Flow

Primary files:

- `client/src/App.tsx`
- `client/src/ScenarioSelect.tsx`
- `client/src/UserMenu.tsx`
- `client/src/types.ts`

## App Modes

`AppMode` lives in `types.ts`.

Current modes:

- `home`: identity-ready main screen with `UserMenu` and `ScenarioSelect`.
- `puzzle`: standalone puzzle play.
- `leaderboard`: individual puzzle leaderboard and score replay summary.
- `admin`: puzzle editor, replacing old Sandbox-first Admin Mode.
- `series-puzzle`: active series run.
- `series-leaderboard`: aggregate series leaderboard and summary.
- `freeplay`: legacy mode still in the type, but Sandbox is no longer the
  Admin Mode entry point.

## Identity Gate

`App.tsx` blocks the rest of the UI until `identityReady` is true.

Identity can be:

- Google user from `useAuth()`.
- Guest name from localStorage key `bbt.guestName.v1`.

`UserMenu` appears on normal non-game screens after identity is ready. Signing
out clears Google auth if signed in, otherwise clears guest name.

## Home Screen

`ScenarioSelect.tsx` owns the main Series/Individual switch.

- Series tab shows the default series row from `client/src/series/default.json`.
- Individual tab shows published scenario tiles.
- Do not reintroduce per-screen scenario title override maps. Scenario
  `name`/`description` JSON is the source of truth.

The identity gate and `home` mode use the tabletop-playbook visual shell:

- `App.tsx` adds `app--landing` only to those two entry surfaces. Do not put it
  on leaderboards, summaries, Admin Mode, or gameplay; it owns the felt/chalk
  background and home theme tokens.
- The home `UserMenu` is passed into `ScenarioSelect` and rendered inside its
  masthead. Non-home screens still render `UserMenu` as their existing sibling
  or HUD control.
- `ScenarioSelect.css` supplies the paper play cards, featured playbook,
  folder-style tabs, and landing-scoped button variants. Generic `.btn` base
  rules stay neutral because the puzzle editor also uses them.
- Individual cards derive their displayed `Play 01`, `Play 02`, etc. labels
  from the loaded scenario array order. These labels are decorative; scenario
  names and descriptions remain the source of truth.
- Home artwork is CSS-only. Off-canvas chalk decoration is contained by
  `app--landing` so 320 px and wider viewports do not scroll horizontally.

## Editor Preview

Puzzle editor uses `onPlay={previewPuzzle}` from `App.tsx`.

Preview state:

- `editorPreviewScenario` stores the draft being previewed.
- Game HUD back button shows `Designer` for editor preview.
- Back from preview returns to `admin`, not `home`.

## Common Change Checks

When changing app modes or navigation:

- Check `App.tsx` render branches.
- Check `handleBackClick`.
- Check whether `UserMenu` should still appear.
- Run `npm run build` and `cd client && npm run lint`.

## Gameplay Action Menu

`PieceMenu.tsx` renders actions in a two-column grid. It measures and clamps
its fixed position to an 8px viewport inset, and keeps its header and Confirm
button visible while only the action grid scrolls on very short screens.
