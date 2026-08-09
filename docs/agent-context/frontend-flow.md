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

`freeplay` has been **removed** from the type. It was never assigned anywhere,
and the multi-turn machinery it needed (End Turn, turn counters, halves, score)
was unreachable dead code. A puzzle is always exactly one turn — see
`game-rules-engine.md`.

Render branches key off `effectiveAppMode`, not `appMode`: Admin Mode falls back
to `home` for non-admins as defence in depth.

## Identity Gate

`App.tsx` blocks the rest of the UI until `identityReady` is true.

Identity can be:

- Google user from `useAuth()`, who must choose a public alias before entering
  the app.
- Guest alias from localStorage key `bbt.guestName.v1` (the legacy key remains
  for compatibility).

`UserMenu` and leaderboards display the public alias, never a Google profile
name or avatar. Google identity is retained only as a stable account key and
for the server-side admin email allowlist. Signing out clears Google auth if
signed in, otherwise clears the guest alias.

## Home Screen

`ScenarioSelect.tsx` owns the main Series/Single Plays switch and exposes
Admin Mode as a third tab for allowlisted admins.

- Series tab shows the default series row from `client/src/series/default.json`.
- Single Plays tab shows published scenario tiles.
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
- Single-play cards derive their displayed `Play 01`, `Play 02`, etc. labels
  from the loaded scenario array order. These labels are decorative; scenario
  names and descriptions remain the source of truth.
- The home masthead uses `client/src/assets/matchday-clash.webp` behind a
  responsive contrast overlay. Off-canvas chalk decoration is contained by
  `app--landing` so 320 px and wider viewports do not scroll horizontally.

## Player-Facing Brand

- The app name is **Turn 16**, referring to the final turn of a Blood Bowl
  game and the do-or-die touchdown plays the puzzles represent.
- Keep the login gate, home masthead, browser title, and README aligned with
  this name and final-turn framing.
- Existing `bbt.*` localStorage keys are compatibility identifiers, not
  player-facing branding. Do not rename them and invalidate saved sessions,
  guest names, or local score history as part of a visual rebrand.
- The footer states that Turn 16 is an unofficial independent training tool,
  is not affiliated with or endorsed by Games Workshop, and that Blood Bowl
  intellectual property belongs to its respective owners.

## Whole-App Rulebook Theme

`client/src/PlaybookTheme.css` is the authoritative late-loaded visual layer
for the battered Blood Bowl rulebook aesthetic. It changes presentation only;
game, navigation, editor, auth, report, and leaderboard behavior remain in
their owning components.

- Every app root uses `app--playbook`, including Admin Mode. Gameplay also uses
  `app--game`, leaderboard and score-summary screens use `app--archive`, the
  identity/home shell uses `app--landing`, and the editor uses `app--admin`.
- `PlaybookTheme.css` is imported after `App.css` so its scoped theme rules win
  while the component stylesheets retain geometry and safe base behavior.
- Shared semantic tokens describe soot/felt, iron, aged parchment, ink/chalk,
  brass actions, rust/destructive states, and Human/Orc accents. Do not add a
  second screen-specific palette or duplicate the token block in `App.css`.
- The theme covers identity, home cards/tabs, game HUD and pitch frame, player
  cards, logs, menus and modals, archives, account/report controls, and the
  Puzzle Editor. Editor panels stay dense, with narrow-screen horizontal
  scrolling contained inside the editor pitch panel.
- Generic `.btn` markup is shared by the landing and editor. Its visual
  hierarchy belongs to the `app--playbook` layer; component CSS should own
  layout rather than reintroducing unrelated button colors.
- On touch devices, game side panels remain hidden by the existing layout, and
  their contents move into `MobileInfoSheet` (see Mobile Layout below).
  Legends, dense result tables, and the editor pitch scroll inside their own
  surfaces so the page itself does not overflow horizontally. Header/HUD report
  controls and the editor account trigger collapse to icon/avatar controls.
- Decorative textures are CSS-only, ignore pointer events, and respect
  `prefers-reduced-motion`. Focus-visible uses the shared brass ring.

## Mobile Layout

The game screen has a distinct touch layout. It is selected by **pointer type
and orientation, never by width** — `useMediaQuery.ts` exposes
`useCoarsePointer()` and `usePortraitViewport()`, and the stylesheets use
`(pointer: coarse)` to match. A `max-width` breakpoint classifies a phone held
sideways (812px wide) as a desktop, which is how the landscape board once
rendered 40% of its squares outside a wrapper with `overflow: hidden`.

### The board rotates

`<Pitch>` takes an `orientation` prop. Game state is always portrait
(`col` 0–14, `row` 0–25); landscape rendering transposes it. On a portrait
touch screen the transpose is skipped, so the board is 15 squares across
instead of 26 — squares go from 11.2px to 23.4px on a 375px phone.

- **Square names never change.** `13G` is the same square in both
  orientations; only the axis each label is drawn on moves. `data-square`
  exposes the name, and it is the stable handle for tests — `aria-label`
  gains the preview's roll details when a square is armed.
- `computeZoomBounds` returns **state** coordinates. The orientation
  transform belongs to the renderer alone; it previously lived in two places.
- End-zone classes are `--endzone-human` / `--endzone-orc`, named for the team
  that scores there, because "left" and "right" stop being true.
- Pitch sizing is one rule solving for a fit on both axes from
  `--pitch-aspect` in container query units. Do not set an explicit width on
  `.pitch` anywhere else — that overrides the calculation and the board clips.
- `.pitch__row-labels` needs `contain: size`; without it the label column is
  taller than the grid's aspect height and stretches the grid, producing
  visibly non-square cells.
- Coordinate gutters remain visible on touch in compact, high-contrast rails.
  Portrait boards show A–O across the top and 0–25 down the sides; landscape
  boards transpose those axes while square names remain unchanged.
- Zoom defaults on for coarse pointers, derived from the media query rather
  than stored, so the player's own choice still wins once they make one.

### Two-stage tap

There is no hover on touch, and a tap emits a synthetic `mouseenter` before
its click — so preview and commit used to land in one gesture and the player
accepted risk they were never shown. On coarse pointers:

- hover-driven preview is disabled entirely;
- the first tap on a reachable square arms and previews it;
- the second tap, or the `.commit-bar` Confirm button, commits;
- the armed key carries the piece id and squares already walked, so changing
  selection or committing a step invalidates it without explicit clearing.

`pathPreviewProb` (in `useGameState.ts`) gives the commit bar its odds. It
mirrors the per-step maths in `handleSquareClick`, including GFI, dodge and
pickup stacking on one square; keep the two together and keep
`pathPreviewProb.test.ts` passing.

### Chrome

- HUD is one row of 44px controls, icon-only (`.hud__btn-text` is hidden). The
  status line is mounted below the board in `.status-strip` instead, and the
  series counter rides with it.
- The legend goes behind a `<details>` disclosure (`LegendShell`).
- `MobileInfoSheet` restores the player card and dice log, collapsed by
  default so the board keeps the height.
- In landscape under 600px tall, `.app--game` becomes a grid that puts legend,
  status and sheet in a column beside the board, recovering the height the
  board is starved of.

### Regression coverage

`client/e2e/` holds a Playwright harness across nine device profiles. jsdom has
no layout engine, so vitest cannot catch any of this. Run it with
`npm run test:e2e` after `npx playwright install`; it is deliberately **not**
part of `npm run verify`, which must pass on a clean checkout without browser
binaries.

## Issue and Feature Reporting

Identified players can report an Issue or Feature request through the reusable
`ReportProblemButton` and `ReportProblemModal`. The floating launcher appears
on home/archive screens; a compact launcher appears in the game HUD. Admin
Mode intentionally has no report launcher.

`App.tsx` owns the dialog state and passes the active app/scenario context,
the identity display name, and optional Google token. The reporter name is
prefilled but editable; the server uses the verified Google name when present.
If delivery fails, the dialog retains the text and offers a Markdown download
for manual filing through Ona or GitHub.

The report launcher is a subdued flag icon with an accessible label and title;
it expands to a 44px hit target on coarse pointers without gaining visual
weight. On the home screen it and the compact user menu share the masthead's
top-right control group; archive screens use the same compact group in the
fixed top-right position. `__BBT_VERSION__` comes from the root package version
at build time (or `VITE_APP_VERSION` when supplied) and is displayed in the
home masthead.

### Published roster portraits

The six roles used by the five published scenarios use generated gritty
medallion portraits in `client/public/*-gritty.webp`:

- Human: thrower, catcher, lineman (blue/ivory armor, bronze frame).
- Orc: blocker, blitzer, lineman (rust/black armor, iron frame).

`Pitch.tsx` and `PlayerPanel.tsx` maintain matching role-to-asset maps. Keep
those maps synchronized when replacing or adding portraits. The optimized game
assets are 512×512 WebP files and are deliberately text-free; role/name labels
remain live UI text. Other editor-only or unpublished roles continue using the
existing fallback art until they receive their own gritty portrait. Published
gritty assets are displayed without a theme filter; fallback sources receive a
scoped `--legacy` portrait class for restrained darkening/desaturation so they
do not clash with the medallion set.

### Gameplay token skill presentation

Gameplay pitch tokens derive their visual skill information from each
player's existing `skills: string[]`; scenario JSON has no separate display
metadata for rings or badges. Keep all mappings and stable display order in
`client/src/skillPresentation.ts` rather than duplicating them in components.

- Concentric outer rings represent the distinct MK.III Season 3 skill groups,
  ordered outer-to-inner as Agility, Devious, General, Mutation, Passing, and
  Strength. Multiple skills in one group produce one ring. Traits such as
  `Animosity`, unknown skills, and empty skill lists produce no ring.
- Separate portrait-overlay badges mark only the canonical FUMBBL-style seven:
  `B` Block, `D` Dodge, `G` Guard, `T` Tackle, `W` Wrestle, `M` Mighty Blow,
  and `L` Leader. The helper owns their stable order and CSS class names;
  other skills do not receive a letter badge.
- Team identity no longer comes from the outer ring. A blue Human or red Orc
  wash is confined to the circular portrait, leaving group rings and exact
  skill badges unchanged. Selection, ball-carrier, activation, downed, and
  ghost states remain separate presentation layers.
- `Pitch.tsx` applies the same rings, badges, tint, and accessible description
  to normal and movement-preview ghost tokens. The gameplay legends name all
  six groups and all seven marked skills so neither color nor a single letter
  is the only source of meaning.
- `PlayerPanel` remains the source for the player's complete, exact skill list,
  including traits and unknown values. The square Puzzle Editor markers remain
  team-colored; editor preview uses the normal gameplay token renderer.

When adding or renaming a supported skill, update the centralized mapping and
`skillPresentation.test.ts` together. Do not fetch palette metadata at runtime
or bake ring, tint, or badge labels into portrait bitmaps.

## Editor Preview

Puzzle editor uses `onPlay={previewPuzzle}` from `App.tsx`.

Preview state:

- `editorPreviewScenario` stores the draft being previewed.
- Game HUD back button shows `Designer` for editor preview.
- Back from preview returns to `admin`, not `home`.

## Notices and Error States

`App.tsx` renders a shared `{notice}` fragment on every screen:

- an **expired-session** banner with a "Sign in again" action, shown whenever a
  Google user is cached but their token has lapsed;
- a dismissible **notice** for non-blocking failures, e.g. the best-effort
  individual submit failing mid-series.

Blocking failures on the touchdown submit go to `SubmitModal`'s `error` prop
instead, which keeps the dialog open with a retry button so the player doesn't
silently lose a run.

On touch devices, the move-confirm bar below the pitch remains mounted as an
invisible placeholder while no square is armed. Its probability label also
keeps its space for safe routes. This holds the bar to the same height in idle,
safe-preview, and risky-preview states so the pitch never resizes between taps.

## Accessibility

- Pitch squares are `role="button"` with `aria-label`s describing the square,
  its occupant, and any pending rolls, and respond to Enter/Space. Only
  *actionable* squares are in the tab order.
- All modals use `useModalFocus` (`client/src/useModalFocus.ts`), which traps
  Tab, wires Escape, and restores focus to whatever opened the dialog. Because
  dialogs stop Escape propagation, `App.tsx`'s global Escape handler only ever
  cancels the current activation.

## Common Change Checks

When changing app modes or navigation:

- Check `App.tsx` render branches (they key off `effectiveAppMode`).
- Check `handleBackClick`.
- Check whether `UserMenu` and `{notice}` should still appear.
- Run `npm run verify` from the repo root.

## Gameplay Action Menu

`PieceMenu.tsx` renders actions in a two-column grid. It measures and clamps
its fixed position to an 8px viewport inset, and keeps its header and Confirm
button visible while only the action grid scrolls on very short screens.
