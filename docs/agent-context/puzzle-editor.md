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

Puzzle Creator renders `PuzzleEditor` with distinct **Puzzle Creator** and
**Series Creator** workflows, plus **Statistics** and **Admin Console** sections. Switching away from an unsaved puzzle is covered by the same
discard confirmation as other editor navigation.

Editor features:

- list all scenarios (including disabled ones) with description, active team,
  piece count, enabled state, and series position,
- create, duplicate, and delete puzzles,
- drag Human/Orc player templates onto the editor pitch,
- auto-generate Blood Bowl style player names,
- **full piece inspector**: name, id, team, role, MA/ST/AG/PA/AV as bounded
  numeric inputs, BB2025 career-skill picker, has-ball, delete,
- move players by drag,
- place ball on a player or loose on the ground,
- save over existing / save as new,
- select the puzzle objective (Touchdown is the only current value),
- independently enable puzzles for everyone and/or admins, and opt them into
  Free Play,
- save changes directly to the player-visible source of truth; enabled flags
  determine what appears outside Admin Mode,
- create, edit, and delete multiple series in the separate Series Creator,
- set each series title, short category label, description, two teams, uploaded
  logo, objective, list position, and everyone/admin enabled states,
- add, remove, and reorder its puzzle steps; this is the single owner of series
  membership, each puzzle can belong to only one series, and assigned puzzles
  must satisfy BB2025 roster limits,
- play draft and return to designer.

The Statistics section shows anonymous player-performance aggregates from the
full retained leaderboard data:

- unique recorded players, deduplicated by verified user id or guest name,
- retained puzzle and series personal-best counts,
- average, median, and best success probability,
- average dice count and latest score date,
- a per-puzzle breakdown plus a full-series summary.
- anonymous engagement patterns: guest/signed-in mix, returning players,
  puzzles per player, and retained-best action counts (dodges, passes, blocks,
  and related actions).

The two admin surfaces also include their own client-side workbench tools:

- Puzzle Creator can search by puzzle id, name, or description and filter the
  list to enabled, disabled, or in-series puzzles without changing drafts.
- Series drafts are edited independently from the open puzzle. Puzzles already
  owned by another series remain visible in the step chooser but are disabled
  and name their owner. Shared validation rejects duplicate membership,
  repeated steps, and enabled series with no playable steps.
- Admin Console owns the Report a problem launcher; player-facing home,
  archive, and game screens do not show it.
- Statistics can search its per-puzzle table, sort every displayed metric, and
  download the anonymous per-puzzle summary as CSV. The export contains the
  same aggregate data already visible on-screen—never names, ids, or move logs.
- Statistics supports all-time, 30-day, and 7-day windows. Windowing happens
  server-side before every puzzle, series, and habit aggregate is calculated;
  undated legacy records stay visible only in all-time views.

Leaderboard storage keeps one personal best per player, not every attempt, so
these figures are explicitly labeled as personal-best statistics. They cannot
represent total attempts or completion rates. The separate game-engagement
section uses privacy-limited first-party game-session summaries for starts,
completion/drop-off, actions, Tutorial progression, and active time. Neither API
returns player names, record-level ids, or move histories to the dashboard, and
the game analytics intentionally excludes traffic/audience data already supplied
by GA4.

### Managed administrators

The Admin Console stores an additional runtime allowlist. The permanent project
owner and administrators in `ADMIN_EMAILS` remain code/deployment configuration
and cannot be removed from the browser; they can add/remove the managed Google
email addresses. Local dev persists this runtime list at
`.bbt-managed-admins.json`; Netlify stores it in the `admin-access` Blobs store.
Every editor endpoint checks the combined list. `/api/editor/access` exposes
only the current caller's boolean capability so the client can hide Puzzle
Creator from everyone else without receiving the list.
The last 100 managed additions/removals are retained with actor, target, and
timestamp and shown in the console; removal has an explicit confirmation.
An unreadable managed-admin store is an access-check failure (503), not an
empty allowlist, so storage trouble cannot broaden administrator access.

Admin Console also lists the public player profiles stored outside leaderboard
records. It shows the public country/nationality label and current avatar and
can remove an unsuitable avatar immediately. This action does not delete the
player's rankings or other profile fields; the player falls back to initials
and may choose a new image later.

Admin Console's Ranking data panel shows full retained counts for every series
and puzzle board. An administrator can clear one puzzle, one series, or all
ranking boards after an explicit destructive confirmation. The complete reset
includes legacy/deleted puzzle keys, while leaving profiles, login history,
analytics, editor drafts, and browser-local attempt history untouched.

### Guards

- **Unsaved-changes guard.** Opening another puzzle, starting a new one,
  reloading, or leaving the editor asks before discarding edits, and a
  `beforeunload` handler covers tab close. Previously all of these discarded
  silently. The Save panel also exposes **Discard Unsaved Changes**, which
  confirms before restoring the open puzzle to its last saved draft without a
  network request. A never-saved puzzle resets to a fresh blank draft.
- **Save is live.** There is no second Publish step. Saving a puzzle or series
  updates the live data immediately. `published !== false` enables it for
  everyone; `adminEnabled: true` additionally enables it in the confirmed-admin
  home view when it is not public. With both off it remains Creator-only.
  Returning home refetches this
  data, and the public endpoint requires cache revalidation so enabled changes
  are not hidden for a minute.
- **Piece ids commit on blur**, not per keystroke — editing them live meant every
  intermediate value (including the empty string) briefly became the real id.

## Local Save API

`server/editor.js` registers (all admin-gated):

- `GET /api/editor/scenarios`
- `POST /api/editor/scenarios`
- `PUT /api/editor/scenarios/:scenarioId`
- `DELETE /api/editor/scenarios/:scenarioId`
- `POST /api/editor/series`
- `PUT` / `DELETE /api/editor/series/:seriesId`
- `PUT /api/editor/series-assignment` (compatibility path for older clients;
  current UI saves membership through Series Creator)
- `POST /api/editor/publish` (legacy cached-client compatibility; now a no-op)
- `GET /api/editor/statistics`
- `GET /api/editor/analytics`
- `GET` / `POST` / `DELETE /api/editor/admins`
- `GET` / `DELETE /api/editor/rankings`

These write local JSON files under:

- `client/src/scenarios/`
- `client/src/series/*.json`

Deleting a scenario also removes its id from every series JSON file.

## Production Editor

Netlify production persists saved editor data in Netlify Blobs:

- `netlify/functions/editor-scenarios.js` handles scenario create/update/delete.
- `netlify/functions/editor-series.js` handles the series collection and exclusive puzzle membership.
- `netlify/functions/editor-publish.js` remains a no-op compatibility endpoint
  for an older cached editor UI.
- `netlify/functions/editor-statistics.js` reads the full leaderboard Blobs and
  returns anonymous aggregates built by `shared/statistics.js`.
- `netlify/functions/editor-analytics.js` reads retained game-session summaries
  and returns aggregate engagement/drop-off data built by
  `shared/analyticsStatistics.js`; it is independent of leaderboard statistics.
- `netlify/functions/editor-admins.js` stores runtime-managed administrator
  emails in a separate protected Blobs store.
- `netlify/functions/editor-rankings.js` counts and clears retained puzzle and
  series ranking boards; all operations are admin-gated.
- `netlify/functions/scenarios.js` serves enabled saved scenarios/series to players.

Saving is immediately player-visible when the item is enabled. Deleting a
scenario also removes it from every series in the same operation.

Admin-only visibility is not implemented by sending hidden records through the
public response. Confirmed admins fetch the protected editor collection and the
client narrows it to public-or-admin-enabled records. `/api/scenarios` continues
to serve only everyone-enabled records and narrows series steps accordingly.

## Creator Workbench Layout

The Puzzle Creator is organized around three task zones rather than a long
stack of editor cards:

- **Puzzle Library** on the left owns search, filtering, selection, creation,
  and duplication.
- **Board Setup** in the centre owns puzzle metadata, objective, Free Play
  availability, and the pitch. The pitch is
  the primary working surface and keeps its native 15-by-26 orientation.
- **Creator Tools** on the right switches between Roster, Player, and Review.
  Selecting a player on the pitch opens the Player tool automatically.

The separate **Series Creator** has a series library and a focused form for
identity/list metadata plus the authoritative ordered membership editor. It
does not require a puzzle to remain open while campaign structure is edited.

Save Puzzle is kept in the persistent creator header. Publishing remains a
separate action and is still disabled while any puzzle or series edits are
unsaved. The status strip reports the active puzzle id and the latest API or
editing result without requiring the admin to scroll to the Review tool.

Above 1100px the three zones share one row. Between 761px and 1100px the
library and board remain side by side while Creator Tools moves below them. At
760px and narrower the zones stack in workflow order and the portrait pitch
scrolls inside its own frame, so the document itself does not widen.

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

Every role in `playerPortraits.ts`'s `PLAYER_ROLES` has dedicated gritty
portrait art, including roles selectable only on an existing piece rather than
the add-player palette. The text-free circular portraits share the same
team-specific frame, palette, and painted style; the coverage test rejects
duplicate fallback art and old non-gritty assets. Unknown roles outside the
editor roster still fall back to the team default.

### Career skills

The selected-player inspector exposes the career skill groups allowed by that
player's BB2025 Human or Orc positional. It separates primary and secondary
access and only offers skills from those groups. The mapping lives in
`client/src/editor/careerSkills.ts`, sourced from the Human and Orc BB2025
roster data at Mordorbihan; traits are not treated as career choices.
Legacy/editor-only roles without a current roster equivalent intentionally show
no picker rather than receiving guessed access.

Only Block, Dodge, Tackle, and Wrestle are selectable because those are the
career skills the rules engine implements. The other applicable career skills
remain visible but disabled/grey so a puzzle author can see what is legal
without accidentally creating a scenario whose rules are not modelled.

## Validation

Client and server share `shared/scenarioValidation.js`, so the editor's live
error list is exactly what the server will enforce. The client previously had
its own looser validator (no stat ranges, no team checks), which meant a
designer could see a clean list and still get a 400 on save.

Roster validation uses the BB2025 Human and Orc team sheets. Both teams may
field at most 11 players in a puzzle. Human caps are 3 Halflings, 2 Catchers, 2
Throwers, 2 Blitzers, and 1 Ogre; Orc caps are 4 Goblins, 2 Throwers, 2
Blitzers, 2 Big Un Blockers, and 1 Troll. Linemen remain bounded by the
11-player on-pitch limit. The roster palette displays current/cap counts and
disables a positional at its cap; the Review panel and both scenario save APIs
enforce the same rules. Series Creator also checks every assigned puzzle and
blocks a series save when a step has an illegal roster.

The BB2025 reduction from four to two Orc Blitzers made the old
`scenario-004` roster illegal. One Blitzer was deliberately converted to an Orc
Lineman without moving the piece. Production-only scenarios such as a puzzle
with two Trolls are not silently rewritten: Admin Mode names the error and the
author must choose which player to convert.

## Auth

Every `/api/editor/*` route is admin-gated, **including GET endpoints** —
drafts contain unpublished puzzles and statistics summarize the full untrimmed
leaderboards. Editor API reads therefore send the `Authorization` header too.
The effective allowlist combines the permanent owner, `ADMIN_EMAILS`, and
Managed Administrators; access requires a verified matching Google user.
Unauthenticated local development can remain open when Google verification is
not configured. Set `EDITOR_ALLOW_UNAUTHENTICATED=false` to make an empty
effective allowlist return 503.
