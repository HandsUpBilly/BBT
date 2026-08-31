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
- `admin`: Puzzle Creator, replacing the old Sandbox-first admin screen.
- `series-puzzle`: active series run.
- `series-leaderboard`: aggregate series leaderboard and summary.
- `settings`: display name, avatar, and player token style — see "Settings
  Screen and Player Prefs" below.
- `help`: illustrated rules pages for getting started, actions, and Parallel
  Universes.

`freeplay` has been **removed** from the type. It was never assigned anywhere,
and the multi-turn machinery it needed (End Turn, turn counters, halves, score)
was unreachable dead code. A puzzle is always exactly one turn — see
`game-rules-engine.md`.

Render branches key off `effectiveAppMode`, not `appMode`: Puzzle Creator falls back
to `home` for non-admins as defence in depth.

## Identity Gate

`App.tsx` blocks the rest of the UI until `identityReady` is true.

Identity can be:

- Google user from `useAuth()`, who must choose a public alias before entering
  the app.
- Guest alias from localStorage key `bbt.guestName.v1` (the legacy key remains
  for compatibility).

The landing action panel stays compact while it contains only the Google and
guest buttons, then expands when the public-alias form appears so the name
field has useful writing room. On phone widths the field and Continue button
stack within the existing landing-page gutters.

`UserMenu` and leaderboards display the player-chosen public alias, never a
Google profile name. A signed-in player may explicitly choose their verified
Google picture as the public avatar; it is not selected automatically. Google
identity is otherwise retained as a stable account key and for the server-side
admin email allowlist. Signing out clears Google auth if
signed in, otherwise clears the guest alias.

The account menu opens **Help & rules**, **About**, and **Settings** beside Log
Out. Help is a full archive-style screen with Getting started, Actions, and
Parallel Universes tabs. Its code-native diagrams explain confirmation controls,
hierarchical universe numbers, branch strips, and lockstep replay without
depending on a particular puzzle screenshot. Like Settings, `App.tsx` records
`helpReturnMode`, so opening Help from the game HUD preserves the puzzle and
returns to it unchanged.

The landing screen, Getting started help, and every Tutorial briefing share the
same objective framing: find the sequence of moves with the highest probability
of meeting the puzzle's stated objective. Current shipped puzzles end in a
touchdown, but the player-facing rule deliberately does not make touchdown the
only possible objective; later one-turn puzzles can target outcomes such as a
successful foul or crowd surf.

Starting the Tutorial opens its drill chooser. Each drill card offers both its
play/replay action and its individual Rankings; returning from those Rankings
restores the chooser and preserves the in-progress series results.

About's focus-trapped dialog is the single player-facing location for the release version
(`__BBT_VERSION__`) and deployment time (`__BBT_DEPLOYED_AT__`), formatted in
the viewer's local timezone. Vite stamps the deployment time when it builds the
bundle; `VITE_DEPLOYED_AT` can override it with an ISO timestamp. The release
version is the root package version without a commit-SHA suffix;
`VITE_APP_VERSION` can replace it explicitly. The home
masthead carries neither label. Because `UserMenu` is shared, About remains
available from home, archives, Puzzle Creator, Settings, Help, and the game HUD.

## Settings Screen and Player Prefs

`SettingsScreen.tsx`, opened from `UserMenu`'s previously-disabled Settings
item, on every screen that renders `UserMenu` (home, archive screens, Puzzle
Creator, and the game HUD). Phase 1 covers display name, avatar, and player token
style; see spec.md "Player Config Screen" for the Phase 2 plan (server-side,
public avatars).

- **Returns to whichever screen opened it, not always home.** `App.tsx` tracks
  `settingsReturnMode` alongside `appMode`, set by `openSettings()` when the
  menu item is clicked. Opening Settings from the game HUD must come back to
  the puzzle in progress — safe because `useGameState` is instantiated once at
  the top of `App.tsx`, independent of `appMode`, so switching to `'settings'`
  and back does not unmount or reset it.
- **`prefs.ts` stores legacy avatar and pitch display preferences**, one JSON object at
  `bbt.prefs.v1` keyed by identity — the same keyed-map shape as
  `bbt.googleAliases.v1`. A Google user is keyed by their subject id; a guest
  uses the fixed key `GUEST_PREFS_KEY` (`'guest'`) rather than being keyed by
  name, because name is itself editable on this same screen and keying by it
  would strand every existing preference on the next rename.
- **Settings uses three task-focused groups.** Profile keeps the avatar beside
  the display-name field; Pitch & players keeps token detail, surface, board
  size, and coordinates together; Tutorial contains the guidance preference.
  These are presentation groups only and do not change how preferences persist.
- **Renaming has a real cost the screen must say out loud.** A signed-in
  player is matched by `userId` and keeps their leaderboard history under any
  name. A guest is matched by `name` (see "Storage Rules" in
  `leaderboard-and-auth.md`), so renaming orphans their personal best under the
  old name — `SettingsScreen` shows a `ConfirmDialog` before committing a guest
  rename, and commits a signed-in rename immediately with no confirmation.
- **Signed-in profiles are public and cross-device.** `avatarImage.ts` decodes a chosen
  file, center-crops it to a square, and downsamples to a fixed 256×256 WebP
  data URL before upload, bounding the payload and stripping EXIF as a side
  effect of redrawing through a canvas. The server independently validates the
  WebP bytes and dimensions. A player may instead explicitly use the picture
  URL from their verified Google token. Their optional country/nationality and
  avatar are public on puzzle and series rankings. Existing `prefs.ts` avatars
  from the local-only release remain private until **Publish current** is used;
  a successful public avatar write removes that legacy copy. Guests have no
  public profile because there is no verified identity to attach it to.
- **Token-style choices are whole-pitch detail levels.** Detailed, Tactical,
  and Plain keep the same six-token formation and team colours while stepping
  down both token and field density: worn textured turf, restrained tactical
  checkerboard, then a flat diagrammatic board. The selected level applies to
  the live pitch as well as the Settings copy. Generated WebP comparisons live
  in `client/src/assets/token-style-previews/` and keep the formation fixed;
  `Pitch.css` owns the code-native live field treatments.
- **Surface and coordinates are independent of token detail.** Grass and
  slate/tile can be paired with any of the three token levels. Coordinate
  labels default on and can be hidden without changing square names in DOM,
  action logs, accessibility labels, or written solutions.
- **Board size (`prefs.ts`'s `boardSize`, default `'medium'`) is a purely
  visual scale, never a layout override.** Small and Large add a CSS
  `transform: scale()` on `.pitch` via a `pitch-wrapper--small`/`--large`
  modifier class in `App.tsx` — they never touch the `--pitch-aspect`
  fit-to-container calculation in `Pitch.css` (see "The board rotates").
  Medium renders with no modifier class, identical to the pre-feature
  behavior. Large also switches `.pitch-wrapper` from centered to
  `flex-start` alignment with `overflow: auto`, because a centered flex item
  that overflows its container cannot be scrolled to on its start side in
  every browser — anchoring Large to the top-left keeps the whole enlarged
  board reachable by scrolling down/right.
- **Tutorial guidance is local, identity-keyed, and concept-based.** A guided
  Tutorial puzzle starts with a compact non-modal objective card that collapses
  when the player begins interacting. New automatic concepts use a caption
  attached to the relevant pitch control or readout; they explain the rule and
  a broad next objective without prescribing a player, square, or route. A
  caption leaves when its action is performed or the player dismisses it.
  Legal alternative play never triggers a warning or hint escalation.
  Tackle Zones/Dodging, Hand-offs, and Pickups are request-only concepts;
  Movement/confirmation, Passing, activation order, Blocks/Blitzes, and
  cumulative probability may introduce themselves non-blockingly. Parallel
  Universes is the sole first-use blocking explanation: a full split diagram
  shows one Block becoming several live boards, then hands off to an opaque
  explanation attached to the real universe strip. That explanation remains
  until the player selects a universe or dismisses it. Editor previews never
  show guidance. `showTutorialGuidance` defaults on and suppresses every
  automatic part when disabled, including the Parallel Universes modal.
- **Concept progress persists per identity.** `prefs.ts` stores each stable
  concept id as Introduced or Used; absence means Not encountered. A Used
  concept does not introduce itself again in another drill. The manual
  **Tutorial guide** remains available regardless of the automatic preference,
  opens a progress-labelled concept list for the current drill, and offers a
  concept explanation followed by an optional broad tactical suggestion—never
  an exact solution. Mini diagrams remain code-native and use the current game
  state. Completed-drill replay asks whether to replay automatic guidance.
  Tutorial action menus expose every action the game rules currently allow;
  teaching order no longer disables otherwise legal actions.
- **Tutorial runs begin and advance through a drill chooser.** The player may
  play the six drills in any order. Completed drills remain selectable for
  replay; a replay replaces that drill's earlier result without increasing the
  completed count. After each completion the chooser returns with updated
  completed/remaining counts. One result per drill combines into the series
  score after every drill has been completed once. The sixth
  drill includes Blocking, Pickup, and Parallel Universes. The chooser also
  shows the last completed run's neutral action sequence and final probability;
  it does not compare the line with an optimum.
- **The compact game HUD keeps every control inside the viewport.** Account
  remains near the front. Zoom, restart, and reporting share the `GameToolsMenu`
  trigger, while the Key and action log retain their own triggers. Compact
  dropdowns use viewport-fixed geometry so no parent can clip them. The empty
  100% success readout leaves the row until a roll puts probability at risk.
  During a guided Tutorial run, Game Tools exposes **Tutorial guide**. It opens
  the current drill's concept library even when automatic guidance is disabled.
  The `?` control is the pitch/skill Key, not Settings.
- **`UserMenu`'s avatar falls back to initials on load failure**, not just on
  absence — a corrupted or future-format data URL degrades the same way a
  missing one does, rather than rendering a broken image icon.

## Home Screen

Player-facing prose uses a compact rulebook voice. Rules instructions use
labels such as OBJECTIVE, ACTION, TEST, LIMIT, STATUS, and SCORE. Prose uses
plain punctuation. Arrows, crosses, dice, and other board symbols remain valid
when they carry rules information rather than joining sentences.

`ScenarioSelect.tsx` owns the main Series/Single Plays switch and exposes
Puzzle Creator only after `/api/editor/access` confirms the current Google
identity against the server's effective administrator list. The response is a
boolean capability; administrator emails are never exposed to the client.

- Series tab shows **Tutorial**, the default series row from
  `client/src/series/default.json`. Starting it opens the drill chooser rather
  than forcing a fixed first puzzle.
- Free Play explains that its matches can be played individually. Its compact
  filter separates matches drawn from a series from future one-off specials.
  Each match card names its source; the current unrestricted board is marked
  as the final puzzle from the Tutorial.
- Do not reintroduce per-screen scenario title override maps. Scenario
  `name`/`description` JSON is the source of truth.

The identity gate and `home` mode use the tabletop-playbook visual shell:

- `App.tsx` adds `app--landing` only to those two entry surfaces. Do not put it
  on leaderboards, summaries, Puzzle Creator, or gameplay; it owns the felt/chalk
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
- The home hero uses `client/src/assets/matchday-hero-v2.webp`, including its
  oversized background wordmark, behind a responsive contrast overlay. The
  live `h1` remains visually hidden for semantics. Off-canvas chalk decoration
  is contained by `app--landing` so 320 px and wider viewports do not scroll
  horizontally.
- The identity gate uses `client/src/assets/identity-tunnel-logo-v2.webp`, with
  the vertical badge baked into the tunnel wall. Generated reusable branding
  lives in `client/src/assets/brand/` and is exposed through `BrandLogo.tsx`:
  the horizontal wordmark leads the home top bar, desktop game HUD, and
  footer, while the compact badge appears in About. Repeated marks are
  decorative so the page exposes only one accessible Turn 16 heading at a
  time.
- The shared `.app` shell uses viewport `min-height`, never a fixed viewport
  height. This lets the flex layout pin `AppFooter` to the bottom on short
  screens while growing normally on long pages instead of leaving the footer
  floating inside a stale viewport-sized box.

## Game Analytics Transitions

`client/src/analytics.ts` is a production-only, non-blocking collector for
game-specific events. It creates a random session id in session storage and
random attempt/run ids, but no persistent browser id. The queue is bounded,
expires after seven days, batches requests, and uses lifecycle beacon delivery.
Network/storage failure never blocks play or score submission.

`App.tsx` emits starts when a published standalone/Tutorial puzzle is
initialized, meaningful play on the first selection/committed action, normalized
action counters from the action log, completion only when the full flat or
Parallel Universes run is complete, and distinct restart/leave/inactivity paths.
Editor previews never start an analytics attempt. Active time ticks only while a
real attempt is active and the document is visible. Google Analytics remains the
owner of generic traffic and audience reporting; do not add those dimensions to
the first-party payload.

Tutorial guide analytics use the allowlisted `tutorial-guide` interaction and
contain only scenario id, stable stage id, and a fixed outcome (shown,
dismissed, stage reached, hint requested, contradiction, skipped, or
completed). Never attach player/piece identity, board state, coordinates,
routes, or authored dialog copy.

## Touchdown Play Diagram

The touchdown summary opens as a wide, focus-trapped tactical review. Its
generated `touchdown-lockup.webp` masthead replaces the former inline ball
glyph and remains decorative beside a live accessible dialog title. The
layout uses the same numbered decision-log treatment as branch review, then
anchors series or leaderboard actions in a separate footer. On narrow screens
the review rows collapse to two columns and the footer actions stack without
introducing horizontal page overflow.

The summary includes a chalkboard-style SVG generated from the
completed puzzle session. `PlayDiagram.tsx` receives the active scenario and
the full `actionLog`, so it can show the starting formation as well as every
committed movement route, pass, handoff, and block. It is not a generic or
pre-rendered football play.

Movement entries are grouped only while their squares remain contiguous. This
preserves separate activations and restarted routes, while still turning the
rules engine's one-entry-per-square log into a readable line. Passes use a
curved amber trajectory, handoffs a short dotted amber line, and blocks a red
contact marker labelled with the dice count. Cancelled activations need no
special handling because rollback already removes them from `actionLog`.

New leaderboard entries also persist a sanitized `playLog` containing only the
fields the diagram reads. Clicking a ranking row therefore reconstructs the
same diagram in `ScoreSummary`. Entries saved before `playLog` shipped remain
valid and show an explicit unavailable message rather than a partial route
built from the risky-roll list.

Parallel Universes use hierarchical addresses everywhere they are shown: the
root is implicit, its first split creates 1, 2, 3, and a later split inside 2
creates 2.1, 2.2, and so on. Summary rows and drill-downs use
these compact numbers so a long chain of player names and block outcomes cannot
crowd the action log out of a phone viewport. The drill-down is a wide tactical
review surface: its header keeps the compact universe number and final outcome,
then shows the complete branch path as visible context. The play diagram and
branch playbook sit in an asymmetric pair on wide screens and stack below 920px.
The numbered decision log follows them, with cumulative probability promoted as
the review's conclusion; its rows collapse to a readable two-column treatment
on narrow screens.

During a series, the touchdown analysis has a **Review Board** action. It hides
the analysis without submitting or advancing, leaving the scored board exactly
as played. A persistent **View Analysis & Continue** bar returns to the same
analysis; the player cannot accidentally bypass the normal score submission or
next-puzzle transition while reviewing.

## Player-Facing Brand

- The app name is **Turn 16**, referring to the final turn of a Blood Bowl
  game and the do-or-die touchdown plays the puzzles represent.
- Brand and landing UI copy lives in `client/src/uiCopy.ts`, so headings,
  controls, and progress wording can be edited or translated together.
  Scenario names and descriptions remain in their scenario JSON because the
  editor and leaderboards consume those same fields.
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

- Every app root uses `app--playbook`, including Puzzle Creator. Gameplay also uses
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
- On compact viewports, game side panels are hidden; the player card moves into
  `MobileInfoSheet` and the action log into the toolbar (see Mobile Layout
  below). Wide viewports keep the rails whatever the pointer type.
  Legends, dense result tables, and the editor pitch scroll inside their own
  surfaces so the page itself does not overflow horizontally. Header/HUD report
  controls and the editor account trigger collapse to icon/avatar controls.
- Decorative textures are CSS-only, ignore pointer events, and respect
  `prefers-reduced-motion`. Focus-visible uses the shared brass ring.

### Two player cards during a two-player action

`playerComparison(state, selected, hovered)` decides what the right rail shows.
Normally one card — the hovered piece, falling back to the selected one. But
while a block, blitz, pass or hand-off is being aimed, the acting piece keeps
its card and the hovered player gets a second one below it, tagged **Acting**
and **Target**.

The reason is that those actions *are* comparisons — attacker ST against
defender ST, receiver AG against the range — and a single card that swapped on
hover made that a memory test: look at the attacker, move the cursor, the
attacker is gone.

`isTwoPlayerAction` deliberately includes more than the three targeting flags:
`pendingBlock` covers a declared Blitz during its movement step (the attacker is
already committed to hitting someone), and `blockChoice` /
`pendingBlockResolution` cover the outcome checklist and the push-back choice,
which are still about the same two players.

Two cards have to fit a rail sized for one. `.side-col--comparing` drops the
portrait's square aspect ratio and hides the crest watermark — the portrait is
the only part worth most of its height, and the stats are the part being read.
The rail also gets `align-self: stretch` and `overflow-y: auto` as a backstop:
`.game-area` aligns its columns to `flex-start`, so without the stretch the rail
is only as tall as its content and could never scroll — it would simply grow
past the board.

Touch has no hover, but `handlePieceClick` sets the same inspected piece a
cursor would, so the comparison reaches `MobileInfoSheet` by the same route; its
tab reads "A vs B" while a pair is showing.

### The pitch key is a toolbar panel, at every size

`LegendMenu` — the pitch-state chips (tackle zone, free move, GFI, dodge) and
both skill keys, behind a **Key** button in the HUD. It follows
`ActionLogMenu`'s dropdown pattern, so the two neighbouring toolbar panels
behave alike: pointerdown outside, Escape with `stopPropagation` so closing a
panel does not also cancel the planned activation.

It used to be a permanent block under the HUD, inline on desktop and behind a
`<details>` on touch (`LegendShell`, now deleted along with the `legend` grid
area and the `.game-legends--collapsible` rules). Two things to keep true if it
ever moves back:

- **The key is reference material, not a readout.** A player reads it once. It
  was charging permanent rent — 36px on a 375×812 phone — in the one dimension
  the board competes for.
- **The trigger carries a count of the contextual entries.** Pass bands, block
  target and push-back square appear only mid-decision, and they used to
  announce themselves by materialising in a visible row. Behind a button they
  would simply be invisible, so the badge says the key has something to add
  about what is happening right now.

`LegendMenu.css` re-scopes two inline-era rules under `.app--game
.legend-menu__dropdown` — `overflow-x: auto` and the sticky left-hand
`legend__key-title` both assume a single horizontally-scrolling row, and the
panel wraps. They are scoped that deep to beat `.app--game .legend` on
specificity rather than on stylesheet order, which the two would otherwise tie
on at (0,2,0).

## Mobile Layout

The game screen adapts along **three independent axes**. Answering any of them
with the wrong query has already produced a shipped defect, twice, in opposite
directions — so keep them apart.

| Question | Query | Hook | Governs |
|---|---|---|---|
| Is there room? | `(max-width: 1024px)` | `useCompactLayout()` | Side columns, board rotation, HUD labels, coordinate gutters |
| Can any connected input hover? | `(any-hover: hover)` | `useHoverCapable()` | Hover previews and waypoint interaction |
| Is the pointer coarse? | `(pointer: coarse)` | *(CSS only)* | Hit-target sizes, nothing else |

The two failures worth remembering:

- **Width alone** classified a phone held sideways (812px) as a desktop, and
  40% of the board rendered outside a wrapper with `overflow: hidden`.
- **Pointer alone** then gave a 1280px touchscreen the phone layout: side
  columns hidden, ~740px of dead space beside a shrunken board, and no hover
  preview on hardware perfectly able to hover.

A big screen keeps its columns whatever is pointing at it; a fingertip needs
44px however big the screen is; hover works whenever a mouse or trackpad is
available, even if touch is primary. No axis is a proxy for another. `1024px`
is the compact threshold because the rails cost
at least 320px, leaving ~27px squares there and only ~16px at 768px — keep the
constant in `useMediaQuery.ts` in step with the stylesheets.

Pointer precision is settled entirely in CSS: no component branches on it. The
`desktop-touch` Playwright project (1280×800, `hasTouch`) is the regression
guard, and its absence is why nothing caught the second failure.

**iPhone desktop-website mode is the narrow exception.** Safari can report an
iPhone's layout viewport as roughly 980px when the user requests desktop
websites, despite the physical phone still needing the compact game shell.
`useCompactLayout()` recognises only iPhone/iPod user agents as an additional
compact signal and `App.tsx` applies `app--compact` so the game shell and pitch
rails use the same compact rules. Do not apply this to iPad or generic coarse
pointer devices: those remain size-driven. The `iphone-xr-desktop-viewport`
Playwright project guards this exact report (#209).

### The board rotates

`<Pitch>` takes an `orientation` prop. Game state is always portrait
(`col` 0–14, `row` 0–25); landscape rendering transposes it. On a portrait
compact viewport the transpose is skipped, so the board is 15 squares across
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
- **There is no automatic crop-to-legal-moves Zoom mode.** An earlier version
  auto-cropped the visible board to the active player's reachable squares on
  compact viewports (`computeZoomBounds` in `bfs.ts`, a `zoomBounds` prop on
  `<Pitch>`, and a HUD/`GameToolsMenu` toggle). It was removed (#228) in favor
  of the player-controlled Settings **Board size** preference below — don't
  reintroduce a crop-based zoom.

### Plot, then confirm

There is no hover on touch, and a tap emits a synthetic `mouseenter` before
its click — so preview and commit used to land in one gesture and the player
accepted risk they were never shown. Route planning now separates waypoints
from the one final decision:

- hover-capable pointers preview freely and click to add each waypoint;
- non-hovering pointers tap once to preview and again to add a waypoint;
- intermediate waypoints never open the final decision controls;
- clicking or tapping the already-plotted route endpoint marks the whole move
  finished, then a green tick and red × appear beside that square for
  **Confirm Move** or **Plot Again**;
- **Plot Again** rewinds the activation to its original board state while
  keeping the same player and declared action selected for a new route.

`pathPreviewProb` (in `useGameState.ts`) gives the endpoint decision its odds. It
mirrors the per-step maths in `handleSquareClick`, including GFI, dodge and
pickup stacking on one square; keep the two together and keep
`pathPreviewProb.test.ts` passing.

### Chrome

- HUD is one row of 44px controls, icon-only (`.hud__btn-text` is hidden). The
  status line is mounted below the board in `.status-strip` instead, and the
  series counter rides with it. `GameToolsMenu` combines restart and
  reporting so account, tools, Key, and action log all fit at 320px.
- The action log is a toolbar dropdown (`ActionLogMenu`), following
  `UserMenu`'s pattern so the neighbouring controls behave alike. Its badge
  shows `rollCount(log)` — rolls, not steps — because that count is what the
  score is built from. It is touch-only; the pointer-fine layout keeps
  `DiceLog` in its always-visible side column.
- `MobileInfoSheet` restores the complete MA, ST, AG, PA, and AV player card.
  It starts collapsed so the board keeps the height, opens when the player taps
  a player who has no action menu, and opens after an action is chosen. The
  action menu itself carries the same five-stat summary, so stats never depend
  on finding a separate gesture. In the sheet the card is a two-column grid
  (portrait beside name), but the stats, skills, and crest span both columns —
  the five stat badges run in a single horizontal row across the sheet's full
  width. Left in the portrait's narrow column they auto-stacked three rows deep
  and forced the short sheet to scroll while the wide column sat empty (#198).
- `PieceMenu` is a floating box anchored to the clicked player's square on
  every pointer type. `placeMenuBesideAnchor()` prefers right, left, below,
  then above while keeping the whole box in the viewport; coarse pointers use
  the same placement with narrower, 44px-target controls, never a bottom sheet.
- `BranchStrip` is a sibling below the HUD, never a child of it. Compact
  universe cards scroll horizontally inside the strip; neither the selector
  nor its scroll width may enlarge the page viewport.
- In landscape under 600px tall, `.app--game` becomes a grid that puts status
  and sheet in a column beside the board, recovering the height the board is
  starved of.

### Reporting committed probability

One number, three places: the action log footer, the HUD percentage, and the
score submitted to the leaderboard. All of them are the last log entry's
`cumulativeProb`, which already contains every roll committed this turn.

**Do not multiply it by `state.pendingProb`.** That field resets on each
activation and accumulates the same per-step values, so it is always a subset
of `cumulativeProb`; multiplying counted the active piece's rolls twice and
reported 0.833⁴ where the truth was 0.833². The submitted score was always
correct, so the interface was under-reporting the player's own line. The only
legitimate extra factor is `pathPreviewProb(state.pathPreview)`, for a route
previewed but not yet committed.

`actionLogDisplay.ts` owns the log's display shaping. `compactDisplayLog`
folds a straight unbroken walk into one line but never merges roll-bearing
steps — a merge keeps only one entry's roll fields, so folding two rushes
together dropped one from the log while the cumulative still counted it.
`actionLogProbability.test.ts` pins the display and the score together.

### Regression coverage

`client/e2e/` holds a Playwright harness across ten device profiles. jsdom has
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

## Contact Workflow

A separate, general-purpose "Contact us" entry lives in `UserMenu`'s dropdown
(`ContactModal.tsx`), alongside Help/Settings/About — not the flag-icon Report
launcher above, which is scoped to bug/feature reports filed as GitHub Issues.
Contact is for anything else (questions, feedback), and is delivered as email
instead:

- **No destination email is ever exposed to the client.** `ContactModal` posts
  name, an optional reply email, and a message to `/api/contact`; the server-only `shared/resendEmail.js`
  sends it via the [Resend](https://resend.com) API to `CONTACT_EMAIL_TO` — a
  destination inbox that lives only in a Netlify environment variable, never
  in the client bundle or any network response. Players can explicitly choose
  that they do not need a reply. When an address is supplied it becomes the
  message's `reply_to`; otherwise the Resend request omits that field.
- **Open to guests, unlike Report a Problem.** There is no identity to gate a
  "get in touch" form on, so `/api/contact` skips the Google-auth check
  entirely and rate-limits by IP/edge-connection address alone
  (`CONTACT_RATE_LIMIT` in `shared/rateLimit.js`, same shape as
  `REPORT_RATE_LIMIT`).
- **Validation lives in `shared/contactMessage.js`**, isomorphic like
  `reporting.js` — the same module the client imports for its field limits and
  the server imports to validate the payload. Name and email reject embedded
  line breaks (they become email headers — display name and `reply_to`); the
  message body allows them freely.
- Requires three env vars to actually deliver mail: `RESEND_API_KEY`,
  `CONTACT_EMAIL_TO`, `CONTACT_EMAIL_FROM` (see README/AGENTS.md). Missing
  configuration surfaces as a 503 with a clear error, same pattern as
  `GITHUB_ISSUES_TOKEN` missing for reports.

## Issue and Feature Reporting

The report launcher is a subdued flag icon with an accessible label and title;
it expands to a 44px hit target on coarse pointers without gaining visual
weight. On the home screen it sits beside a deliberately larger account
trigger in a group anchored 10–12px from the masthead's top-right corner.
Archive screens use the same control group in the fixed top-right position.
`__BBT_VERSION__` comes from the root package version at build time without a
commit-derived suffix (or uses `VITE_APP_VERSION` unchanged when supplied). It
is displayed in About.

### Published roster portraits

The six roles used by the six published scenarios use generated gritty
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

### Player token detail styles

The Settings screen offers three player-token detail levels (`prefs.ts`'s
`tokenStyle`, default `'portrait'`): Detailed uses portrait art, skill rings,
and badges; Tactical (`'simple'`, retained for stored-preference compatibility)
uses team-coloured discs with a role-specific positional glyph, role code,
rings, and badges; Plain uses clear role-code discs without the glyphs, rings,
or badges. Plain's two-letter disc matches the puzzle editor's own
`.editor-piece` marker.

Implemented as pitch-level `pitch--simple` and `pitch--plain` classes on
`<Pitch>`'s outer element, not props threaded through `Square`. `PieceIcon`
always renders both the portrait `<img>` and a `.piece__role-code` span; CSS
decides which is visible and whether the skill decoration is collapsed.
`Square` is memoized because hovering re-renders `<Pitch>` on every
mouse-move, and a prop touching all 390 squares for a value that changes
approximately never would be exactly the kind of presentation-in-a-component-
prop coupling `useMediaQuery.ts` deliberately avoids for pointer precision —
see the three-axis table above.

Editor preview reuses the same `<Pitch>` call as normal play, so it inherits
whichever token style the currently signed-in admin has chosen — there is no
separate editor-only setting.

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

On non-hovering devices, the move-confirm bar below the pitch remains mounted
as an invisible placeholder while no square is armed. Its probability label
also keeps its space for safe routes. This holds the bar to the same height in
idle, safe-preview, and risky-preview states so the pitch never resizes between
taps. Hover-capable layouts show the armed bar as a fixed overlay instead, so
the pitch also remains stable there.

The game HUD keeps the success-chance readout mounted as an invisible 100%
placeholder until a roll is involved. Reserving the readout's final dimensions
prevents the HUD and pitch from resizing when a risky move is confirmed.

## Accessibility

- Pitch squares are `role="button"` with `aria-label`s describing the square,
  its occupant, and any pending rolls, and respond to Enter/Space. Only
  *actionable* squares are in the tab order.
- All modals use `useModalFocus` (`client/src/useModalFocus.ts`), which traps
  Tab and restores focus to whatever opened the dialog. Dismissible dialogs
  pass a close callback so Escape closes them; required-choice dialogs such as
  the touchdown review omit it. Because dialogs stop handled Escape events from
  propagating, `App.tsx`'s global Escape handler only ever cancels the current
  activation.

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
