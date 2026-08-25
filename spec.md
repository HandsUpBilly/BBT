# Blood Bowl Tactical Puzzle — Spec

---

## Status Index

This file mixes shipped history with forward plans. Every top-level section
carries a **Status** line — read it before treating a section as work to do.

| Section | Status |
| --- | --- |
| Skill-Group Player Icon Bands | Shipped |
| Whole-App Gritty Rulebook Visual Overhaul | Shipped |
| Issue and Feature Request Reporting | Shipped |
| Handoff Action | Shipped |
| Pass Action | Shipped |
| Scenario 002 — The Handoff Play | Shipped |
| Dodge Skill Reroll | Shipped |
| Leaderboard — Move Summary on Row Click | Shipped |
| Leaderboard — Netlify Deployment | Shipped |
| Puzzle Mode | Shipped (Free Play removed) |
| Series Mode Specification | Shipped |
| Google Social Sign-On Plan | Shipped |
| Puzzle Editor / Creator Plan | Shipped |
| Bug Fix — Pass/Handoff fails when receiver already activated this turn | Shipped |
| Agent Context Documentation Plan | Shipped |
| Loose Ball Pickup | Shipped |
| Block and Blitz Actions | Shipped (with rules simplifications) |
| BB Tactics — Tabletop Playbook Home Redesign | Shipped |
| Leaderboard and Report Integrity | **Planned** |
| Player Config Screen | Phase 1 Shipped, Phase 2 **Planned** |
| Block Outcomes as Board-State Branches | Shipped as the standard Parallel Universes block model |
| Tutorial Series and Parallel Universes Onboarding | Shipped |
| Step-by-step Tutorial Coach | Shipped |
| Engagement Analytics and Admin Graphs | Shipped |
| Full-game Rulebook Copy Audit | Shipped |
| Completed Play Diagram | Shipped |
| Per-Puzzle Attempt History | Shipped, local-only |
| Two-Player Card Comparison | Shipped |
| Review Completed Series Board | Shipped |
| Pass / Hand-off Confirmation and Illustrated Help | Shipped |
| Parallel Universe Branch-point Reset | Shipped |
| Completed-play Review Orientation and Objective Guidance | Shipped |

Durable behavior that has already shipped belongs in `docs/agent-context/`, not
here. When a plan below ships, move the facts worth keeping into the matching
context doc and mark the section Shipped rather than deleting it — the rationale
is often still useful.

---

# Skill-Group Player Icon Bands

**Status:** Shipped. Implemented as concentric skill-group rings, portrait team tinting, and canonical FUMBBL-style skill badges.

### Status and Decisions

This section is implementation-ready and defines the replacement for the
team-colored rings currently drawn around gameplay player tokens.

- **Band meaning:** colored rings identify the Blood Bowl skill groups
  represented by a player's `skills` array; they no longer identify the team.
- **Reference system:** use the category colors and skill assignments from the
  [Charlie Victor MK.III 32mm Skill Bands (Season 3)](https://www.charlievictorproducts.com/collections/skill-bands-mk-iii/products/mk-iii-32mm-skill-bands)
  linked in the request.
- **Multiple groups:** render one full concentric ring for each distinct skill
  group. Multiple skills in the same group still produce only one ring.
- **No categorized skill:** render no skill ring. This applies to players with
  an empty `skills` array, traits such as `Animosity`, and unknown/unmapped
  values.
- **Team identity:** tint only the circular portrait area with a subtle blue
  wash for Humans or red wash for Orcs. The tint must not affect the skill
  rings, selection/carrier indicators, ball marker, or other state UI.
- **Exact-skill markers:** overlay separate FUMBBL-style letter badges for the
  canonical seven commonly marked skills: Block, Dodge, Guard, Tackle,
  Wrestle, Mighty Blow, and Leader. Other skills do not receive a letter.
- **Scope:** gameplay pitch tokens, including movement-preview ghost tokens,
  plus the minimum legend/panel treatment needed to explain the bands and
  badges. This is not a scenario-data, rules-engine, portrait-art,
  editor-token, or broad theme redesign.

The implementation preserves application behavior and portrait/scenario assets. The
existing specification sections below remain unchanged and independent.

### Goal

Make pitch tokens use the tabletop convention of colored skill bands while
keeping the Human/Orc distinction immediately visible. A player should be able
to recognize represented skill groups at a glance, inspect the player to see
the exact skill names, spot the most tactically important individual skills,
and continue to distinguish team and gameplay state without one color carrying
multiple meanings.

### Functional Requirements

#### Skill classification

- Derive band groups at render time from the existing `skills: string[]` on
  `PlayerPiece`/`ScenarioPieceDef`. Do not add a required field to scenario
  JSON and do not rewrite published scenarios merely to support the visual.
- Define the six MK.III Season 3 groups as a closed TypeScript union:
  `agility`, `devious`, `general`, `mutation`, `passing`, and `strength`.
- Maintain a centralized, case-sensitive skill-name-to-group map. The initial
  map must cover the complete skill catalogue represented on the linked
  MK.III product, not only the four skill names in today's published puzzles:

  | Group | Skills |
  | --- | --- |
  | Agility | Catch, Defensive, Diving Catch, Diving Tackle, Dodge, Hit and Run, Jump Up, Leap, Safe Hands, Sidestep, Sprint, Sure Feet |
  | Devious | Dirty Player, Eye Gouge, Fumblerooski, Lethal Flight, Lone Fouler, Pile Driver, Put the Boot In, Quick Foul, Saboteur, Shadowing, Sneaky Git, Violent Innovator |
  | General | Block, Dauntless, Fend, Frenzy, Kick, Pro, Steady Footing, Strip Ball, Sure Hands, Tackle, Taunt, Wrestle |
  | Mutation | Big Hand, Claws, Disturbing Presence, Extra Arms, Foul Appearance, Horns, Iron Hard Skin, Monstrous Mouth, Prehensile Tail, Tentacles, Two Heads, Very Long Legs |
  | Passing | Accurate, Cannoneer, Cloud Burster, Dump-Off, Give and Go, Hail Mary Pass, Leader, Nerves of Steel, On the Ball, Pass, Punt, Safe Pass |
  | Strength | Arm Bar, Brawler, Break Tackle, Bullseye, Grab, Guard, Juggernaut, Mighty Blow, Multiple Block, Stand Firm, Strong Arm, Thick Skull |

- `Animosity` remains visible in the existing player skill list but is treated
  as a trait, not assigned a skill-group color, and does not create a ring.
- Unknown skill strings must fail soft: preserve their existing text display,
  omit a band for them, and do not throw, block scenario loading, or silently
  assign a misleading fallback category.
- Deduplicate by group, then sort groups in one documented canonical order:
  Agility, Devious, General, Mutation, Passing, Strength. Use that order from
  outermost to innermost whenever a player has multiple groups so rings do not
  reorder as scenario skill arrays change.

#### Band colors and rendering

- Define semantic CSS custom properties for the six band colors in one place.
  Use the linked MK.III category palette as the visual source of truth:

  | Group | Required visual color | Initial CSS target |
  | --- | --- | --- |
  | Agility | warm beige/tan | `#dcc49d` |
  | Devious | deep purple | `#522a83` |
  | General | deep blue | `#214f91` |
  | Mutation | vivid pink/magenta | `#cc4397` |
  | Passing | bright yellow | `#f5e600` |
  | Strength | light cyan | `#52bdd4` |

  The implementation may make small adjustments after in-app contrast review,
  but must preserve these recognizable category hues and document any final
  values next to the tokens.
- Render one continuous circular band per unique group. Bands are nested and
  concentric; do not use segmented arcs, a single priority band, duplicate
  rings for two skills in the same group, or team-colored fallback bands.
- Keep every ring visible at normal and zoomed pitch sizes. Ring thickness and
  inter-ring keylines may scale with token size, but the portrait must remain
  recognizable with all six groups present. Cap decorative gaps/shadows rather
  than allowing the token to overflow its pitch square.
- A player with no categorized group has no colored outer skill band. A thin
  structural edge around the portrait is acceptable only if it reads as the
  portrait frame rather than a neutral or team-colored skill band.
- Skill-ring colors remain unchanged by Human/Orc tinting and by activated,
  downed, selected, carrier, or ghost state treatments.

#### FUMBBL-style exact-skill badges

- In addition to category rings, render one separate compact letter badge on
  the portrait for each of these seven exact skills. Use the established
  FUMBBL-style letter/color pairing rather than deriving a first initial for
  every skill:

  | Skill | Badge | Badge color | Initial CSS target |
  | --- | --- | --- | --- |
  | Block | `B` | blue | `#2864c7` |
  | Dodge | `D` | yellow | `#e4ca22` |
  | Guard | `G` | green | `#2f9b50` |
  | Tackle | `T` | orange | `#df8126` |
  | Wrestle | `W` | white | `#f1efe5` |
  | Mighty Blow | `M` | red | `#c83d38` |
  | Leader | `L` | purple | `#7443a6` |

  The marker convention follows documented
  [FUMBBL community usage](https://fumbbl.com/index.php?name=PNphpBB2&file=viewtopic&t=30986),
  where skill markers use compact characters such as `G` for Guard and
  distinct colors for the commonly marked skills. These badge colors identify
  exact skills and are a separate visual vocabulary from the MK.III ring
  colors, which identify skill groups.
- Match skill names exactly against the existing `skills` array. Do not show a
  badge for `Catch`, `Animosity`, another non-canonical skill, or an unknown
  string, even though a non-canonical skill may still contribute a category
  ring.
- Render at most one badge per canonical skill. Duplicate strings in malformed
  input must not create duplicate badges.
- When several canonical skills are present, show separate badges rather than
  a combined character row. Sort them in this stable order: Block, Dodge,
  Guard, Tackle, Wrestle, Mighty Blow, Leader. Do not depend on scenario-array
  order.
- Place the badge cluster inside the circular portrait boundary and above the
  portrait image/team tint. Use a compact flex/wrap or equivalent layout near
  the portrait perimeter so the markers read as part of the player icon, not
  as another outer ring. Keep each letter upright when the token is standing.
- Size badges responsively and permit a second compact row when necessary. All
  seven must fit without enlarging the pitch token, overflowing its square, or
  hiding the entire portrait. The all-seven case is a robustness fixture; the
  normal published scenarios use far fewer markers.
- Badge foreground color, outline, and shadow must keep the character legible
  on its assigned background and over both Human and Orc portraits. In
  particular, use dark text/outline for the white Wrestle and yellow Dodge
  badges where needed; do not assume one foreground color fits all seven.
- Badges remain visible through the Human/Orc portrait wash and retain their
  own colors in activated, selected, carrier, downed, and ghost states. Downed
  rotation applies to the complete token, including badges. Ghost opacity may
  fade the complete token uniformly but must preserve relative badge contrast.
- Coordinate badge placement with the centered ball marker and bottom-right
  action label. The ball and live action/state UI take precedence, but the
  implementation must avoid routine overlap rather than simply hiding skill
  badges on carriers or selected players.

#### Team tint and gameplay states

- Place the team wash in a dedicated circular portrait layer beneath the
  exact-skill badges and any live ball marker, and inside all skill rings:
  - Human: subtle blue wash.
  - Orc: subtle red wash.
- Tune opacity/blending so the team reads at token size without obscuring faces
  or flattening the existing gritty portrait artwork. Do not edit, regenerate,
  duplicate, or globally filter the portrait source files.
- Keep the tint on the portrait only. It must not color the ring wrappers,
  exact-skill badges, selection halo, carrier halo, action label, or pitch
  square.
- Refactor the existing state styles so they coexist with category rings:
  - selection remains a clearly visible white external halo and scale change;
  - ball carrier remains a clearly visible gold external halo and ball marker;
  - activated and downed states remain recognizable without changing the
    category identity of their rings;
  - downed rotation applies to the complete token as it does now;
  - ghost tokens reproduce the selected player's skill rings and team tint,
    then apply the existing ghost opacity/dashed or equivalent preview cue.
- Do not use the old blue Human/red Orc outer borders after the change. Team
  color belongs to the portrait wash; skill color belongs to the rings; game
  state belongs to external halos/overlays.

#### Explanation and accessibility

- Add a compact, named skill-band key in or adjacent to the existing gameplay
  legend. It must show all six group names with their corresponding swatches,
  remain usable in the legend's existing inner-scroll behavior, and not cause
  page-level horizontal overflow on narrow screens.
- Add a distinct **Skill markers** row/key for the canonical seven badges,
  showing each badge beside its full skill name. Do not combine this with the
  six group-color key in a way that implies their color systems are the same.
- Preserve the exact skill names in `PlayerPanel`. The panel may add the
  matching group color to known skill chips to reinforce the legend, but must
  keep unknown skills and traits legible with a neutral treatment.
- Give each rendered token an accessible description containing the player's
  name, team, represented skill-group names, and full names of any canonical
  marked skills. Do not make assistive-technology users infer meaning from a
  badge letter, color, or portrait image filename.
- The token decoration system must not reduce token click/touch targets.
  Decorative ring and tint layers and visual badge spans ignore pointer events
  and do not create separate focus targets. Badge meaning is exposed through
  the token's combined accessible description rather than seven repetitive
  child nodes.
- Verify that adjacent category colors and the tint remain distinguishable in
  grayscale/color-vision simulations. The text legend and inspected player
  details are the non-color equivalents; do not encode exact skills only in
  rings.

### Constraints and Non-Goals

- Preserve game rules, pathfinding, action availability, probability math,
  score calculation, scenario loading, and all state transitions.
- Preserve the existing `skills: string[]` API and scenario JSON format. This
  change classifies skill strings and derives the curated marker set for
  presentation only.
- Do not change the meaning or behavior of `Block`, `Dodge`, `Catch`,
  `Animosity`, or any other skill/trait in the rules engine.
- Do not modify published portrait assets or the synchronized role-to-asset
  mappings in `Pitch.tsx` and `PlayerPanel.tsx` except as needed to consume a
  shared presentation component/helper without changing resolved files.
- Do not replace the player portraits, add bitmap ring assets, fetch the
  product page at runtime, add remote assets/fonts, or introduce a new runtime
  dependency. Bands, tint, and letter badges are live HTML/CSS presentation;
  do not bake the letters into portrait bitmaps.
- Do not redesign the square editor markers in this change. Editor preview
  enters the normal gameplay renderer and therefore receives the new bands;
  the editor's own drag/drop markers remain team-colored and unchanged.
- Do not remove the team styling from the side player panel, team crests, HUD,
  or other non-token UI. Only the gameplay token's rings, portrait tint, and
  exact-skill badges change in this scope.
- Avoid `!important`-based state collisions. Separate the structural token,
  skill bands, portrait/tint, exact-skill badges, and external state halo
  layers so each concern can be styled independently.

### Architecture

| Area | Responsibility |
| --- | --- |
| New `client/src/skillPresentation.ts` | Own `SkillGroup`, canonical group order/labels, the complete skill-to-group map, the canonical seven badge definitions/order, and pure helpers that return deduplicated ordered groups and marked skills from `skills: string[]`. It must not import React or game-state logic. |
| `client/src/Pitch.tsx` | Pass each actual or ghost player's `team`, `role`, `name`, and `skills` to the token portrait renderer. Replace the current team-border-only `PieceIcon` markup with explicit nested skill-band, portrait-frame, tint, image, and exact-skill badge layers while retaining the synchronized portrait map and ball/state markup. |
| `client/src/Pitch.css` | Define the token layer geometry, six semantic band variables/classes, seven exact-skill badge recipes, concentric sizing, portrait-only team tint, badge wrapping/contrast, and independent selected/carrier/activated/down/ghost treatments. Remove the old Human/Orc outer-ring colors. |
| `client/src/App.tsx` and existing legend CSS | Add separate six-item skill-group and seven-item exact-skill-marker keys alongside the current contextual movement/pass/block legend without altering existing conditional entries. Keep responsive overflow contained. |
| `client/src/PlayerPanel.tsx` / `.css` | Continue listing exact skills. Optionally consume the same classification helper for colored known-skill chips and neutral trait/unknown chips; do not duplicate the mapping. Existing panel team framing remains. |
| `client/src/skillPresentation.test.ts` | Unit-test group classification plus canonical badge inclusion, exclusion, deduplication, and ordering for empty, malformed, mixed, and all-seven skill lists. |
| `docs/agent-context/frontend-flow.md` | Record the shipped token semantics, ring and badge palette sources, canonical marker whitelist/order, team-tint boundary, unknown/trait fallback, and the rule that presentation mappings stay centralized. |

The token DOM should conceptually separate these layers:

```text
external state halo (selected / carrier / ghost cue)
└─ zero or more concentric skill-group rings
   └─ portrait frame
      ├─ portrait image
      └─ portrait-only Human/Orc tint
         ├─ zero or more FUMBBL-style exact-skill badges
         └─ live ball marker and action/state overlays above them
```

The exact component name is an implementation detail. Prefer keeping a small
local renderer in `Pitch.tsx` unless sharing it with `PlayerPanel` removes real
duplication; do not broaden this into a portrait-system rewrite.

### Implementation Steps

1. Add `skillPresentation.ts` with the closed group type, canonical
   outer-to-inner order, labels, full MK.III Season 3 mapping, canonical seven
   badge definitions/order, and pure group/marker helpers. Add focused unit
   tests before changing rendering.
2. Restructure the pitch token markup into independent state-halo, band,
   portrait-frame, portrait-image, team-tint, and exact-skill badge layers.
   Pass the real player's skills/name/team to both normal tokens and
   movement-preview ghosts.
3. Replace `.piece--human`/`.piece--orc` outer border colors with portrait-only
   tint classes. Implement nested, deduplicated group rings using semantic CSS
   variables and stable canonical order.
4. Move selected and carrier emphasis to external halos so neither overwrites
   skill colors. Reconcile activated, downed, ghost, action-label, and ball
   layering, including combined states such as selected carrier and downed
   skilled player.
5. Render separate canonical badges inside the portrait using their stable
   order and FUMBBL-style letter/color recipes. Tune the one-, multi-, and
   all-seven layouts against portrait, ball, and action-label visibility.
6. Add separate six-group and seven-marker text/swatches to the gameplay
   legend and, if used, color known `PlayerPanel` skill chips through the
   shared helper while leaving traits/unknowns neutral.
7. Update the frontend context documentation with the durable classification
   and rendering rules. Check for stale comments that describe the outer ring
   as the team identifier.
8. Run automated and visual verification, fix regressions, and confirm no
   portrait/scenario asset changed.

### Verification

- Unit tests cover:
  - `Block` → General, `Catch`/`Dodge` → one Agility group, and representative
    skills from Devious, Mutation, Passing, and Strength;
  - same-group deduplication;
  - deterministic canonical ordering independent of input array order;
  - mixed-group input producing multiple ordered groups;
  - `[]`, `Animosity`, and unknown strings producing no groups without errors;
  - mixed known/unknown input retaining only the known groups;
  - each canonical badge maps to the required letter/color definition;
  - non-canonical skills produce no badge, including categorized `Catch`;
  - duplicate canonical skills produce one badge each and shuffled input
    returns the stable `B`, `D`, `G`, `T`, `W`, `M`, `L` order.
- In each of the five published scenarios, visually confirm Human and Orc
  portrait tints, General bands on `Block`, one Agility band on players with
  both `Catch` and `Dodge`, no band on `Animosity`-only/unskilled players,
  `B` badges for Block, `D` badges for Dodge, and no `C`/`A` badge for Catch or
  Animosity.
- Create or use an in-memory/test fixture covering two, three, and all six
  groups and zero, one, several, and all seven badges to verify concentric
  order, badge order/wrapping, portrait legibility, and containment. Do not add
  a published scenario solely for this fixture.
- Check normal, selected, carrier, selected-carrier, activated, downed, ghost,
  and legacy-portrait tokens. Confirm rings retain their colors in every state
  and badges retain their letters/colors, while the ball/action labels remain
  visible.
- Review normal and zoomed gameplay at 1440×900, 768×1024, 390×844, and
  320×568. Confirm token targets and pitch geometry are unchanged, the legend
  scrolls internally if necessary, and no page-level overflow is introduced.
- Inspect keyboard/screen-reader output for the token description and named
  legends. Check grayscale and common color-vision simulations; exact groups
  and marked skills must remain discoverable through text even when hues are
  ambiguous.
- Verify published portrait files and scenario JSON are unchanged with the
  final diff.
- Run:

  ```bash
  npm run build
  cd client && npm run lint
  cd client && npm test -- --run
  ```

### Success Criteria

- Gameplay tokens no longer use blue/red outer rings to mean Human/Orc.
- Every known skill produces its MK.III Season 3 group color; same-group skills
  produce one ring, mixed groups produce stable concentric rings, and traits,
  unknowns, and skillless players produce no skill ring.
- The canonical seven exact skills render separate, stable FUMBBL-style badges
  (`B`, `D`, `G`, `T`, `W`, `M`, `L`) with their specified colors; all other
  skills render no letter badge.
- Humans remain recognizable through a subtle blue portrait tint and Orcs
  through a subtle red portrait tint, with portrait detail still clear and all
  band colors unchanged.
- Selection, ball carrier, activation, downed, and ghost treatments coexist
  with the bands and badges and remain at least as clear as before.
- The gameplay legend separately names all six groups and all seven exact-skill
  markers, the inspected player still exposes exact skill text, and assistive
  text communicates player/team/group/marker meaning without relying on color
  or single-letter codes alone.
- Portrait assets, scenario schema/content, editor markers, gameplay behavior,
  and pitch geometry are unchanged; no dependency or runtime network request
  is added.
- The centralized mapping/tests make later skill additions explicit, and build,
  lint, and the full test suite pass.

---

# Whole-App Gritty Rulebook Visual Overhaul

**Status:** Shipped. Landed as "Unify app with gritty rulebook theme"; PlaybookTheme.css now owns the whole-app visual layer.

### Status and Decisions

This section is implementation-ready and records the visual direction chosen
for the overhaul:

- **Aesthetic:** Blood Bowl rulebook — aged, battered, practical, and
  print-driven rather than bright or cute.
- **Scope:** the whole app, including the identity gate, home and challenge
  selection, gameplay, shared dialogs and menus, leaderboards and summaries,
  report flow, and Puzzle Editor/Admin Mode.
- **Art direction:** preserve the existing gritty artwork and use it as the
  quality and mood reference. In particular, do not regenerate, brighten, or
  redraw `client/src/assets/matchday-clash.webp` or the six published
  `client/public/*-gritty.webp` roster portraits.
- **Delivery:** perform the implementation on a dedicated
  `design/gritty-rulebook-ui` branch created from an up-to-date `main`, rather
  than adding the overhaul to an unrelated feature/fix branch.

Planning this work does not create the implementation branch or modify product
code. Branch creation is the first implementation step.

This section supersedes the older, historical home-only and player-facing
visual-extension scopes later in this file wherever they conflict. Those
sections remain as records of the already-shipped incremental theme work; they
must not be read as exclusions from this whole-app overhaul.

### Goal

Make every app surface feel like part of the same well-used Blood Bowl
coach's rulebook as the masthead clash artwork and gritty player medallions.
The UI should feel physical, competitive, and weathered while remaining easy
to read and operate. Bright paper-note cards should become aged tactical
sheets; generic dark application panels should become ink, iron, leather, or
soot-backed rulebook surfaces; controls should look stamped, tabbed, or
mechanically labeled rather than soft and modern.

This is a visual-system overhaul, not a game redesign. Navigation, copy, game
rules, scenario data, editor operations, authentication, leaderboards, and API
behavior remain unchanged.

### Visual Requirements

#### Mood and hierarchy

- Use the existing clash masthead and player portraits as the tonal anchor:
  dirty armor, worn paint, smoke, oxidized metal, aged leather, muted team
  colors, and hard contrast.
- Retain a rulebook/tabletop metaphor, but remove the cheerful stationery
  cues. Paper surfaces should be darker and visibly aged, with restrained
  stains, edge wear, faded ruling, registration marks, stamps, or ink
  abrasion. Avoid clean cream cards, bright sticky tape, pastel note styling,
  playful rotations, and soft floating-card shadows.
- Establish a clear material hierarchy:
  - soot/felt is the app background and negative space;
  - iron or blackened leather frames navigation, HUDs, toolbars, and durable
    controls;
  - aged parchment carries reading-heavy content and forms;
  - ink, oxblood/rust, muted Reavers blue, and aged brass communicate status,
    team, selection, and primary action hierarchy.
- Decorative grit must be subtle enough that text, pitch state, table rows,
  inputs, and validation messages remain immediately legible. Texture should
  come primarily from CSS gradients, borders, shadows, and pseudo-elements;
  do not place high-contrast noise directly under dense content.
- Typography should feel printed and utilitarian. Continue using the existing
  slab-serif display stack and monospaced/stamped label stack, with a highly
  readable system sans-serif for body copy and dense data. Do not add a remote
  font dependency.
- Corners should be tighter and more irregular-looking than the current soft
  application panels. Use strong keylines, inset wear, offset print/shadow
  details, and restrained transforms; do not rotate interactive controls or
  dense data tables enough to affect alignment or hit targets.

#### Color system

- Replace duplicated, screen-specific color literals with one shared family
  of semantic theme tokens for background, iron, parchment levels, primary
  and muted ink, chalk, brass/action, rust/danger, Reavers blue, Orc red,
  borders, focus, shadows, and overlays.
- Darken and desaturate the current `--home-paper-*`, gold, blue, rust, and
  felt values to sit naturally beside the preserved artwork. Parchment can be
  lighter than the shell but must read as stained tan/khaki rather than clean
  cream.
- Preserve the established meaning of gameplay colors. Reachability, tackle
  zones, pass bands, block targets, push targets, Human/Reavers, Orc, success,
  risk, and error states must remain distinguishable in context and must not
  depend on color alone.
- Primary actions use aged brass; destructive/error states use oxblood/rust;
  Human/Reavers accents use muted, scuffed blue; Orc accents use dark rust-red.
  Reserve bright values for focus, selected state, and critical feedback.

#### Existing artwork and icons

- Preserve the source files, role-to-asset mappings, proportions, focal
  composition, and intended team identities of `matchday-clash.webp` and the
  six 512×512 gritty WebP portraits. Responsive CSS positioning, overlays, and
  frames may be adjusted only to integrate them into the shared rulebook shell
  and maintain text contrast.
- Keep the gritty portraits readable at board-token and player-panel sizes.
  Frames, rings, selected/activated states, ball markers, and team indicators
  must not obscure faces or the held ball in the Thrower portrait.
- Keep `Pitch.tsx` and `PlayerPanel.tsx` role-to-asset mappings synchronized.
- Existing non-gritty fallback portraits/icons used by editor-only or
  unpublished roles are not to be regenerated in this change. When displayed,
  give them the same medallion frame and a restrained darkening/desaturation
  treatment so they do not break the visual system. Do not globally filter the
  published gritty assets.
- Use live text for names, roles, controls, and statuses. Do not bake labels
  into bitmap artwork, and do not replace semantic controls with decorative
  images.

### Surface Coverage

The overhaul is incomplete unless all of these surfaces use the shared visual
language:

1. **Identity gate:** sign-in panel, guest-name field, action buttons, labels,
   focus/error/disabled states, and background.
2. **Home and selection:** masthead framing and overlay, user/report controls,
   version label, Series/Single Plays/Admin tabs, series feature panel,
   challenge cards, metadata, and all card actions.
3. **Gameplay shell:** page background, HUD, score/probability/status blocks,
   back/restart/zoom/end-turn/report/user controls, legend, pitch frame,
   board overlays, side panels, portraits, stat/skill chips, action log, piece
   menu, block choices, and every phase/confirm/submit modal.
4. **Archive surfaces:** individual and series leaderboards, empty/loading/error
   states, highlighted rows, avatars, reload/back controls, individual score
   summaries, series summaries, and horizontally scrollable dense data.
5. **Account and reporting:** user trigger/dropdown in every placement, report
   launchers, report form, validation, delivery error, download fallback, and
   success state.
6. **Puzzle Editor/Admin Mode:** editor page shell, header/actions, puzzle list,
   metadata form, pitch frame and grid, player/ball markers, palettes, tool
   panels, series ordering, validation/status messages, publish/save/delete
   hierarchy, and editor preview transition. The editor remains dense and
   work-focused but is no longer visually isolated from the player theme.
7. **Responsive and transient states:** hover, pressed, selected, active,
   disabled, focus-visible, drag, targeting, loading, empty, success, warning,
   error, modal backdrop, and reduced-motion behavior.

### Functional and Accessibility Constraints

- Do not change component behavior, app-mode transitions, game-state logic,
  scenario/series ordering or copy, editor persistence/publish semantics,
  authentication, report delivery, leaderboard consistency handling, or API
  contracts.
- Keep scenario JSON `name` and `description` as the only source of challenge
  names and descriptions.
- Keep all controls as semantic HTML controls and preserve current accessible
  names. Decorative texture and pseudo-elements must use no pointer events and
  must not enter the accessibility tree.
- Every keyboard-operable control must have a visible, consistent focus ring
  that is not clipped by distressed frames. Hover-only affordances require an
  equivalent focus/selected state.
- Text and essential icons must meet WCAG 2.2 AA contrast: at least 4.5:1 for
  normal text and 3:1 for large text and meaningful UI graphics. Disabled
  controls may be muted but must still be recognizable.
- Preserve readable zoom behavior and layouts from 320 px wide upward. No page
  should gain horizontal overflow. Existing intentional inner scrolling for
  legends, tables, editor regions, or short-screen menus may remain.
- Preserve the pitch's aspect ratio, square geometry, target/reachability
  clarity, pointer targets, and mobile zoom/cropping behavior.
- Preserve or improve minimum touch targets around compact controls; aim for
  44×44 CSS pixels on narrow screens where layout permits.
- Respect `prefers-reduced-motion`; physical-looking hover/press movement must
  be disabled there. Do not add ambient animation, flicker, parallax, or
  animated grain.
- Do not add a new runtime dependency, external texture CDN, remote font,
  generated image set, or additional network request for this overhaul.
- Avoid broad unscoped selectors that can leak into the board or editor. Theme
  tokens may be global to the app root, but component rules remain scoped to
  their existing root classes and mode modifiers.

### Architecture

The implementation should consolidate the theme that currently spans
`App.css`, `ScenarioSelect.css`, `PlaybookTheme.css`, component-local CSS, and
an intentionally separate `PuzzleEditor.css`.

| Area | Responsibility |
| --- | --- |
| `client/src/App.tsx` | Apply the shared `app--playbook` theme root to every render branch, including Admin Mode; retain `app--landing`, `app--game`, `app--archive`, and add an admin modifier only if mode-specific layout needs it. Do not change render behavior. |
| `client/src/PlaybookTheme.css` | Become the authoritative visual-system layer: semantic tokens, material recipes, focus treatment, shared control language, mode shells, shared modals, archives, and cross-surface responsive/reduced-motion rules. Update its comment and scope to include Admin Mode. |
| `client/src/App.css` | Keep reset and structural app/game layout rules. Remove duplicated landing theme tokens and obsolete visual defaults once equivalent shared rules exist; do not alter pitch sizing or gameplay layout behavior. |
| `client/src/ScenarioSelect.css` | Keep landing layout and masthead composition. Restyle paper cards/tabs/actions using shared tokens and material recipes; preserve responsive card/action layout and the existing hero asset. Move generic `.btn` visual ownership to a genuinely shared layer so the editor and player surfaces use one hierarchy. |
| `client/src/editor/PuzzleEditor.css` | Retain dense editor grids and responsive breakpoints while adopting shared tokens/materials for panels, forms, tool palettes, pitch framing, actions, validation, and statuses. |
| Component CSS (`UserMenu.css`, `ReportProblem.css`, `Leaderboard.css`, `ScoreSummary.css`, modal/menu/panel/log/pitch styles) | Remove conflicting bright/soft or generic-dark fallbacks, consume shared semantic tokens, and keep component-specific geometry. Existing base styles can remain where they provide safe behavior before theme overrides. |
| `client/src/Pitch.tsx` and `client/src/PlayerPanel.tsx` | Preserve and keep synchronized the published gritty role maps. Mark fallback art only if a narrowly scoped class is needed for the legacy-art treatment. |
| `docs/agent-context/frontend-flow.md` | Replace the obsolete statement that Admin Mode is deliberately excluded and document the shipped whole-app rulebook system, preserved assets, and future extension rules. |

Prefer CSS custom properties and small reusable material recipes over copying
full declarations among mode selectors. Keep source-order intentional:
structural/component CSS first and `PlaybookTheme.css` last, as it is today,
so the theme remains predictable without specificity escalation or
`!important` rules.

### Implementation Steps

1. Update local `main`, create and switch to
   `design/gritty-rulebook-ui`, and confirm the worktree contains no unrelated
   changes before editing. Do not base the visual overhaul on the current
   `fix/open-issues` branch unless those commits have already reached `main`.
2. Inventory representative before-state screenshots at desktop and mobile
   widths for the identity gate, home Series and Single Plays tabs, gameplay,
   a modal, a leaderboard/summary, the user/report menus, and Admin Mode. Use
   these as a regression checklist, not as new repository assets unless the
   project later chooses to keep visual snapshots.
3. Define the final semantic palette and material/focus primitives once in
   `PlaybookTheme.css`. Apply the shared theme root to all `App.tsx` branches,
   including Admin Mode, and remove duplicated theme variables from
   `App.css`/landing-only scopes.
4. Consolidate shared controls: buttons, tabs, inputs, select/textarea,
   dropdowns, chips/stamps, paper sheets, iron panels, modal backdrops,
   selected/disabled/error/success states, and focus rings. Move the generic
   `.btn` treatment out of `ScenarioSelect.css` while retaining existing class
   names and behavior.
5. Rework the identity and home surfaces toward the darker aged-rulebook
   direction. Preserve the clash artwork; adjust only its crop/contrast overlay
   and frame. Replace clean cream/sticky-note cues with stained parchment,
   worn edges, ink marks, iron framing, and subdued tape/stamp accents.
6. Reconcile the gameplay styles currently split between component CSS and
   `PlaybookTheme.css`. Apply the material hierarchy to the HUD, legend, pitch
   frame, panels, logs, menus, and dialogs while protecting pitch geometry and
   gameplay-state color meanings. Verify the six gritty portraits at their
   smallest and largest rendered sizes.
7. Restyle archives, account controls, and reporting end to end, including all
   async, validation, highlight, empty, failure, download, and success states.
   Dense tables/forms prioritize legibility over decorative texture.
8. Bring Puzzle Editor/Admin Mode into the shared theme without loosening its
   information density or changing its behavior. Cover desktop three-column,
   stacked tablet, and narrow mobile layouts, editor pitch state, palette drag
   affordances, destructive actions, publishing, and status/validation text.
9. Remove superseded literals and overrides after each surface is covered.
   Check for duplicated token definitions, stale comments about Admin Mode
   isolation, unscoped rules, unexpected specificity, unused selectors, and
   accidental references to non-gritty portrait files in published roles.
10. Perform the verification matrix below, fix visual/functional regressions,
    and update `docs/agent-context/frontend-flow.md` with the final durable
    theme boundaries and asset rules.

### Verification Matrix

- Review at minimum 1440×900, 1024×768, 768×1024, 390×844, and 320×568.
- At each relevant width, cover identity gate; home Series, Single Plays, and
  Admin tab; gameplay with a selected player and targeting overlay; player
  panel and action log where visible; one shared modal; leaderboard and score
  summary; user dropdown; report form error/success treatment; and Puzzle
  Editor.
- Exercise keyboard-only navigation through the identity form, home tabs/cards,
  gameplay controls/menu/modal, archive controls/rows, account/report flows,
  and editor fields/actions. Confirm visible focus and usable Escape/dismissal
  behavior.
- Inspect normal, hover, active, focus-visible, selected, disabled, loading,
  empty, success, warning, error, and destructive states where applicable.
- Check with `prefers-reduced-motion: reduce`, browser zoom at 200%, and narrow
  viewports for clipped focus rings, obscured controls, illegible texture, and
  page-level horizontal scrolling.
- Verify that masthead and published portrait files are unchanged (for example,
  with `git diff --numstat`/checksums) and that both portrait maps still point
  to the same six gritty WebPs.
- Run the repository checks:

  ```bash
  npm run build
  cd client && npm run lint
  cd client && npm test -- --run
  ```

### Success Criteria

- The masthead art, gritty published portraits, and every surrounding UI
  surface visibly belong to one dark, battered Blood Bowl rulebook system;
  no major screen retains the bright/cute paper-note or generic modern-dark
  appearance.
- Identity, home, game, archive, reporting/account, transient dialogs, and
  Admin Mode all use the same semantic palette, typography hierarchy, material
  recipes, button/input language, focus treatment, and state conventions.
- The preserved hero and six gritty portrait source files are byte-for-byte
  unchanged, remain clearly framed/cropped, and are not globally filtered or
  obscured by UI decoration.
- Published player roles still resolve to the correct gritty art in both pitch
  tokens and player panels; legacy fallback art receives a consistent scoped
  treatment when encountered.
- All existing flows and interactions behave as before. No game rules, state,
  navigation, scenario content, API/auth behavior, leaderboard flow, report
  flow, or editor save/publish behavior changes as part of the redesign.
- Essential text and meaningful graphics meet the stated contrast targets;
  keyboard focus is obvious; status is not communicated only by color; and
  texture never compromises dense data or form readability.
- All reviewed layouts work from 320 px upward without new page-level
  horizontal overflow, clipped dialogs/focus rings, blocked touch targets, or
  changes to pitch geometry and zoom behavior.
- Reduced-motion behavior is respected, no runtime/external asset dependency
  is introduced, the frontend context documentation matches the shipped
  whole-app scope, and build, lint, and tests pass.

---

# Issue and Feature Request Reporting

**Status:** Shipped. Report launcher, modal, /api/reports, and the Markdown download fallback are live. Rate limiting was added later; see "Leaderboard and Report Integrity".

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
- Preserve the existing responsive behavior, reduced-motion behavior,
  identity flow, leaderboards, game rules, and Admin Mode functionality. The
  newer whole-app visual-overhaul section intentionally supersedes the old
  requirement to keep Admin Mode visually isolated.

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

# Handoff Action

**Status:** Shipped. Implemented in useGameState (handleHandoffAction/handleHandoffTarget) with tests in useGameState.test.ts.

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

# Pass Action

**Status:** Shipped. Range table, pass/catch rolls, and range overlay are live in bfs.ts and useGameState.ts.

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

# Scenario 002 — The Handoff Play

**Status:** Shipped. Lives at client/src/scenarios/scenario-002.json.

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

# Dodge Skill Reroll

**Status:** Shipped. Movement dodges made by a Dodge-skilled player include one exact shared reroll per activation.

## Rule

The Dodge skill supplies one reroll shared by every dodge test in that player's
activation. Because the puzzle engine does not simulate failures, the reroll is
represented in the probability chain rather than assigned to a particular
step. For dodge success chances `p1..pn`, the probability that the line
succeeds with no more than one initial failure is:

`product(p1..pn) * (1 + sum(1 - pi))`

The engine carries the conditional probability that the reroll remains
available across committed steps and separate movement clicks. This preserves
the action log's invariant that multiplying every `actionProb` produces the
submitted score.

Each dodge remains one risky-move entry and therefore counts once toward the
existing leaderboard `diceCount`. Entries whose probability benefits from the
skill carry `dodgeSkillReroll: true`, allowing the live log, touchdown summary,
and saved leaderboard summary to identify the skill reroll without inventing a
separate roll entry.

## Acceptance Criteria

1. A single dodge at base chance `p` scores as `p * (2 - p)` for a player with Dodge.
2. Multiple dodges share exactly one reroll, including when movement is committed over several clicks.
3. Players without Dodge retain the existing probability calculation.
4. Cancelling or ending the activation clears its reroll state.
5. Preview, committed action log, submitted score, and saved move summary agree.

---

# Leaderboard — Move Summary on Row Click

**Status:** Shipped. Both leaderboards persist `moves` and render ScoreSummary on row click.

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

# Leaderboard — Netlify Deployment

**Status:** Shipped. See netlify/functions/leaderboard.js. NOTE: the storage section below says "top 10" while the API section says "top 20" — the shipped behavior is that the store keeps EVERY entry and only the read is truncated (10 on Netlify, 20 locally).

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

One Netlify Blob per scenario, keyed by `scenarioId`. Each blob contains a JSON array of `LeaderboardEntry` objects. On every write the full array is read, upserted, and written back.

**Corrected during implementation:** an earlier draft of this section trimmed the *stored* array to the top 10. That deleted a player's personal best the moment they dropped out of the visible table, which then broke both the by-userId upsert and the home screen's "Best / Rank" display. The store now keeps every entry and only the read is truncated.

```json
[
  { "id": "uuid", "scenarioId": "scenario-001", "name": "Alice",
    "probability": 0.694, "diceCount": 3, "date": "2026-05-02T..." },
  ...
]
```

### Requirements

1. **Netlify Function** at `netlify/functions/leaderboard.js` handles both GET and POST for `/api/leaderboard/:scenarioId`.
2. **GET**: Read blob for `scenarioId`, return the top 10 sorted `probability DESC`, `diceCount ASC`. Return `[]` if the blob doesn't exist yet. (The local Express server returns 20; only the visible slice differs.)
3. **POST**: Read blob, upsert by `userId` for signed-in players and by `name` for guests, keeping the *better* of the two runs, then write the full list back. Return whatever entry survived on the board.
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
   - GET: read blob → parse JSON → return the top 10.
   - POST: read blob → upsert by name → sort → trim → write blob → return entry.
2. Add `@netlify/blobs` to a new `netlify/package.json` (or root `package.json`).
3. Create `netlify.toml` at repo root with build config and redirects above.
4. Update `client/vite.config.ts`: keep the `/api` proxy for local dev; no other changes.
5. Add `netlify/node_modules` and `.netlify` to `.gitignore`.
6. Test locally with `netlify dev` or the existing Vite + Express setup. Each scenario presents a fixed pitch state (piece positions, ball position, opponent positions). The player plans a sequence of activations to move the ball carrier into the end zone. The game tracks the cumulative probability of the chosen sequence succeeding. On touchdown, the score (probability % + dice roll count) is submitted to a global leaderboard. Players compete to find the highest-probability route to a touchdown.

The current prototype (hot-seat two-player free play) remains as a sandbox/dev mode. The puzzle mode is the primary product.

---

# Puzzle Mode

**Status:** Shipped, with one deliberate divergence. Mode 2 (Puzzle Mode) is the whole game now. Mode 1 (Free Play) was removed: a puzzle is always exactly one turn, so the multi-turn loop, score, half, and turn counters no longer exist.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript (Vite) |
| Backend | Node.js (Express) — serves frontend, hosts leaderboard API |
| Database | Stubbed in-memory for now; interface designed for Supabase/Postgres later |
| Styling | Plain CSS |

---

## Mode 1 — Free Play — REMOVED

Originally a hot-seat two-player sandbox with no scenarios and no leaderboard.

**Removed.** A puzzle is always exactly one turn — that is the core of the game —
so the multi-turn loop this mode needed (End Turn, turn counters, halves, the
running score) was never wired to any UI and has been deleted. Do not
reintroduce it: anything that lets a player bank a turn and start fresh also
resets the probability chain that *is* the score.

---

## Mode 2 — Puzzle Mode

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
- API: `GET /api/leaderboard/:scenarioId` returns the top entries (20 locally, 10 on Netlify).

### Leaderboard API (stubbed)

The Express server exposes:

```
GET  /api/leaderboard/:scenarioId   → top entries (20 local / 10 Netlify)
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

**Status:** Shipped. See series/default.json, resolveSeriesScenarios, and the series leaderboard.

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

**Status:** Shipped. Google Identity Services + guest identity, verified server-side via shared/googleAuth.js. Token expiry handling was added later (client/src/auth.ts isTokenExpired).

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

**Status:** Shipped. Including the piece inspector (stats, skills, team, role), puzzle-list metadata, and the missing-series-id warning, all of which were outstanding for a while. Local dev writes JSON files; Netlify uses Blobs drafts plus an explicit Publish.

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

# Bug Fix — Pass/Handoff fails when receiver already activated this turn

**Status:** Shipped. Fixed; guarded by regression tests in useGameState.test.ts.

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

# Agent Context Documentation Plan

**Status:** Shipped. docs/agent-context/ exists and is routed from AGENTS.md.

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

**Status:** Shipped. Pickup rolls fold into the probability chain; see bfs.ts pickupTargetAt and the tests in useGameState.test.ts.

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

**Status:** Shipped, with rules simplifications. Live. Later fixes made a knocked-down carrier drop the ball, made a Blitz block cost a square of movement, and excluded marked assisters. Still simplified: no Guard, no armour/injury rolls, and no chain pushes. The outcome-checklist design below is **superseded** by the shipped Parallel Universes model; the ST/dice/assist and push-back rules in this section remain current.

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

**Assists** — each standing teammate adjacent to the opposing block participant
adds +1 to that side's effective Strength, unless another standing opponent
marks the candidate. The two players directly involved in the block do not
cancel assists. Both attacker and defender count their own eligible assists.

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

> **Superseded.** This checklist design shipped as a deliberate stopgap and is
> replaced by *Block Outcomes as Board-State Branches* at the end of this file.
> It is kept because it describes what is currently live, and because the
> combined-probability formula below survives as the degenerate case of the
> replacement. The part being replaced is the player declaring which faces
> count as success — in a real game you do not choose the result.

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

- Add `countEligibleAssists(opposingPlayerPos, teammates, excludeTeammateId,
  opponents, opposingBlockPlayerId)` — count standing teammates adjacent to
  the opposing block participant, excluding candidates marked by another
  standing opponent. Guard remains out of scope.
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
   individually correct probabilities, based on the effective ST/eligible-assist
   comparison and correct attacker-picks/defender-picks dice
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
2. **Rules math** (`client/src/bfs.ts`) — `countEligibleAssists`,
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

**Status:** Shipped. Has its own Status section below.

## Status

Historical specification for the already-shipped first visual redesign pass.
Its home-only scope and palette are superseded by **Whole-App Gritty Rulebook
Visual Overhaul** above.

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

This phase records the already-shipped player-facing extension. Its exclusion
of Admin Mode is superseded by the newer whole-app overhaul above.

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

---

# Leaderboard and Report Integrity

**Status:** Planned — partial mitigations shipped.

## Problem Statement

The client computes a run's probability and submits it. Nothing server-side
recomputes it from the rules engine, so a crafted request can claim any score.

## What already ships

`shared/scoreValidation.js` closes the cheap holes:

- probability must be a finite number in `(0, 1]` and diceCount a bounded
  integer, so NaN/Infinity/negatives can never corrupt the sort;
- `diceCount` must equal the number of submitted moves;
- the product of the submitted per-action probabilities must match the claimed
  total, so a tamperer cannot raise the number on an otherwise real run;
- a worse run never overwrites a better one (`upsertPersonalBest`);
- `shared/rateLimit.js` caps report submissions per session.

## What is still open

Two gaps remain, and neither is closable without the rules engine:

1. **A forged clean run is accepted.** `{probability: 1, diceCount: 0,
   moves: []}` passes, because walking to the end zone with no rolls is a
   legitimate 100% solution on some scenarios. Nothing in the payload
   distinguishes the two.
2. **An internally consistent but fabricated move list is accepted.** The
   checks verify the arithmetic of what was submitted, not that those moves
   were reachable on that scenario.

Closing both needs a server-side replay:

1. Load the scenario by id on the server.
2. Re-run the submitted moves through the rules engine (`bfs.ts` would need to
   become environment-neutral, or move into `shared/`).
3. Reject the submission if the replay's probability, dice count, or final board
   state disagrees with what was claimed.

This is deferred because it requires the rules engine to be shared between the
client and both server targets, which is a larger refactor than the leaderboard
warrants today. The per-instance report rate limiter is likewise best-effort on
Netlify — a Blobs- or KV-backed counter would make it a hard cap.

## Acceptance Criteria

- A replayed submission that does not reproduce the claimed probability is
  rejected with a 400 and never reaches the leaderboard.
- Legitimate submissions from the real client are unaffected.

---

# Completed Play Diagram

**Status:** Shipped. The touchdown summary renders a responsive chalkboard SVG
from the active scenario and that run's complete action log.

The diagram is session-specific rather than stock artwork. It shows the
starting formation, groups contiguous movement steps into committed routes,
draws passes and handoffs as distinct ball trajectories, and marks blocks with
their dice count. Because cancelled activations are rolled back out of the
action log, they do not appear in the completed play.

New individual leaderboard records persist a separate sanitized `playLog`, so
clicking a ranking row reconstructs the same completed-play diagram in its
score summary. Existing records keep only risky moves, not every free movement
step; they remain readable but show an explicit unavailable message instead of
an incomplete diagram.

# Per-Puzzle Attempt History

**Status:** Shipped, local-only. Requested in issue #68 ("I should be able to
see a history of all my attempts at each puzzle... some graphic that showed
improvement over time"). Every completed run is recorded on the device and
shown under that puzzle's rankings, with a chart. Nothing is stored server-side
— see Non-goals.

## Problem Statement

The leaderboard cannot answer "am I getting better at this puzzle?", and it is
not supposed to. `upsertPersonalBest` never lets a worse run replace a better
one, deliberately: submitting a sloppy run after a clean one used to destroy
the good result. So the one row a player has on a board is their high-water
mark, and every run that led up to it — the whole shape of their improvement —
is discarded at submit time.

## What ships

`client/src/attemptStore.ts` keeps `{ at, probability, diceCount }` per
completed run, per scenario, under `bbt.attempts.v1`, oldest first, capped at
50 runs per puzzle. Every read revalidates: unparseable JSON, a non-object
payload, or an entry that is not a well-formed attempt degrades to "no
history", never to a broken screen.

A run is recorded when the game state reaches the `touchdown` phase, not when a
score is submitted. The request was for a history of *attempts*, and a run the
player chose not to put on the board is exactly the kind the leaderboard cannot
show. Restarting rebuilds the state at `playing`, which re-arms the guard.

`client/src/AttemptHistory.tsx` renders under the per-puzzle rankings: run
count, best, latest, and points gained since the first run; an inline SVG line
chart on a fixed 0-100% axis with the personal best drawn as a rule across it;
and a table of every run, newest first. The chart is `role="img"` with a
spoken summary, and the table is the accessible version of the same data.

Improvement is measured from the first run to the *best* one, not to the
latest, so a bad run after a good one reads as "you haven't beaten it yet"
rather than as going backwards. A single run reports no improvement figure at
all — "no progress" and "nothing to compare" are different answers.

## Non-goals

**It does not sync.** The history is per-device, and the panel says so. Making
it follow an account would mean writing every attempt — including every bad one
— to Netlify Blobs against a player's identity: new storage, a retention
policy, and a guest story (guests are keyed by a self-chosen name, so their
history would be trivially readable by anyone who typed the same one). None of
that is warranted to answer "am I improving", which the local record answers
completely for the device the player is actually on.

If it is ever wanted server-side, the shape to reuse is the leaderboard's:
`shared/` for the validation, a capped list per key in Blobs, and the
`rateLimitKey` bucket for writes.

## Acceptance Criteria

- Finishing a run at a puzzle adds exactly one entry to that puzzle's history,
  whether or not the score is submitted.
- The rankings screen for a puzzle shows every recorded run for it, newest
  first, with the best one marked.
- The chart plots one point per run against a fixed 0-100% axis.
- A storage failure — quota, private browsing, no Storage API — costs the
  history and nothing else.

---

# Two-Player Card Comparison

**Status:** Shipped. Requested directly: "any action that involves a second
character, and I mouse over that character, the player card should show below
the original card, so that I now see two cards ... so that I can compare stats."

## Problem Statement

Block, blitz, pass and hand-off are all decisions about two players. Whether to
throw the block depends on the attacker's Strength against the defender's, plus
assists; whether to throw the pass depends on the receiver's Agility against the
range band. The right rail showed one card, and hovering *replaced* it — so
reading the target's stats destroyed the attacker's. Comparing two players meant
memorising one of them.

## What ships

`playerComparison(state, selected, hovered)` returns `{ primary, secondary }`.
While `isTwoPlayerAction(state)` holds and the cursor is on a piece other than
the acting one, `primary` is the acting piece and `secondary` is the hovered
one; otherwise `secondary` is null and the single-card behaviour is exactly what
it was.

`isTwoPlayerAction` covers more than the three targeting flags. `pendingBlock`
is a declared Blitz during its movement step — the attacker is already committed
to hitting someone, so sizing up candidates while walking is the point.
`blockChoice` and `pendingBlockResolution` cover the outcome checklist and the
push-back choice, which are still about the same two players.

Each card carries an **Acting** or **Target** tag when paired. Two cards of
identical shape stacked vertically are otherwise a guessing game about which
player is doing the thing.

Fitting two cards in a rail sized for one: `.side-col--comparing` drops the
portrait's square aspect ratio (a square portrait in a 210px rail is 210px of
height on its own) and hides the crest watermark. The stats, which are the part
being read, keep full size. The rail stretches to the row height and scrolls as
a backstop.

## Non-goals

- **No stat diffing.** The cards do not highlight which player wins each stat.
  The request was to see both; inferring "who wins" for Strength is not a
  straight comparison anyway once assists are involved, and a green arrow that
  ignored them would be worse than no arrow.
- **No pinning.** The second card follows the cursor and disappears with it.

## Acceptance Criteria

- Aiming a block, blitz, pass or hand-off and hovering another player shows two
  cards, acting on top.
- Hovering the acting piece itself, or a piece with no action under way, shows
  one card exactly as before.
- The pair never widens the page or shrinks the board.

---

# Player Config Screen

**Status:** Phase 1 shipped, local-only. Requested directly: a config screen,
logged-in-user dependent, starting with avatar upload, display name, and a
toggle from the current portrait player tokens to something closer to the
puzzle editor's simplified markers.

## Problem Statement

`UserMenu` already had a "Settings" item — disabled, "Coming soon" — with
nowhere to send it. Three settings were requested: an uploaded avatar, a
display-name change, and a simplified alternative to the gameplay portrait
tokens for players who find the gritty art busy or want a cleaner board.

Two of the three fork immediately on where they're stored. Display name and
token style are pure client preferences, no different in kind from the guest
alias or the token color rings already in `localStorage`. An avatar meant to
appear on a *leaderboard* is public, user-generated content visible to every
other player — that needs a server, validation independent of the client,
and a moderation story, none of which exists yet. Building both halves in one
pass would have meant either shipping the local half now and reworking it once
the server exists, or blocking the whole screen on the larger piece.

## What ships (Phase 1)

- **Display name.** Reuses the identity gate's existing `setGoogleAlias` /
  `setGuestAlias` — no new storage. A guest rename is confirmed first (see
  below); a signed-in rename commits immediately, since it's matched by
  `userId` and keeps its history either way.
- **Avatar — local only.** `client/src/avatarImage.ts` validates type
  (PNG/JPEG/WebP) and source size (≤8MB), then decodes, center-crops, and
  downsamples to a fixed 256×256 WebP data URL before anything is stored.
  Held in `client/src/prefs.ts` (`bbt.prefs.v1`), visible in `UserMenu` and the
  Settings screen on this device only — **not** on leaderboards, which is
  exactly the boundary that keeps it out of moderation/reporting territory for
  now. Gated on being signed in, even though nothing about local storage
  strictly requires it, so the gate doesn't move once Phase 2 (below) makes it
  a real requirement.
- **Player token style.** A `tokenStyle: 'portrait' | 'simple' | 'plain'`
  preference, also in `prefs.ts`. The three Settings choices are Detailed
  portraits, Tactical team-coloured discs with positional glyphs, role codes,
  and skill markers, and Plain role discs without glyphs or markers. See
  "Player token detail styles" in
  `docs/agent-context/frontend-flow.md` for why this is a single CSS class on
  `<Pitch>` rather than a prop threaded through the memoized `Square`.
- **New `'settings'` AppMode.** Opened from `UserMenu` on every screen that
  renders it (home, archive screens, Admin Mode, game HUD) and returns to
  whichever one opened it via a tracked `settingsReturnMode`, not always home
  — see "Settings Screen and Player Prefs" in `frontend-flow.md`.

### Guest rename orphans a personal best — the screen says so

Guests are matched by `name` on the leaderboard (`upsertPersonalBest`), not by
an account id. Renaming a guest is therefore indistinguishable from a new
player showing up: their existing best stays on the board under the old name,
unreachable from the new one. `SettingsScreen` shows a `ConfirmDialog`
explaining this before committing a guest rename. A signed-in rename has no
such cost — matched by `userId` regardless of display name — so it commits
immediately.

## Non-goals (Phase 1)

- **No public avatar.** Not shown on any leaderboard row, not uploaded
  anywhere, not tied to `LeaderboardEntry`.
- **No cross-device sync.** Same posture as the guest alias and attempt
  history: `localStorage`, per browser.
- **No avatar for guests.** No verified identity to attach one to under the
  Phase 2 design below; gating it now avoids a second migration later.

## Future Enhancements — Phase 2 (public avatar)

Making the avatar visible to other players is a materially larger feature,
deliberately deferred rather than folded in:

- **Storage + read path.** Netlify Blobs keyed by Google subject id, behind a
  new authenticated `PUT` and a public `GET /api/avatar/:userId` — mirrored in
  `server/index.js` for local dev, same split as every other endpoint in
  `netlify-deploy.md`.
- **Independent server-side validation.** The client-side resize is a
  convenience, not a control — same posture as `shared/scoreValidation.js`.
  The endpoint must re-check content type, byte length, and decoded dimensions
  itself.
- **Rendering needs no new field.** `LeaderboardEntry` already carries
  `userId` via `entryAuthFields()`; `Leaderboard.tsx` and
  `SeriesLeaderboard.tsx` could request `/api/avatar/{userId}` with a fallback
  to initials on error, with no change to what's stored in an entry.
- **Moderation.** Public user-uploaded images need a report path and an admin
  removal action — the single largest piece of work in this phase, and the
  reason it stayed out of Phase 1 rather than riding along as a rider.
- **Rate limiting.** The existing `shared/rateLimit.js` bucket-by-verified-user
  approach applies directly to the upload endpoint.

## Acceptance Criteria (Phase 1)

- Settings is reachable from the account menu on every screen it appears on,
  and Back returns to that same screen, including mid-puzzle.
- Changing the display name updates it everywhere `identityName` is used,
  immediately for a signed-in player, after confirmation for a guest.
- Uploading a non-image or oversized file shows an error and leaves the
  existing avatar and preference state untouched.
- The token style selector changes gameplay pitch tokens app-wide immediately;
  skill-group rings and letter badges remain visible in Detailed and Tactical,
  contrast, while Plain deliberately removes that decoration.
- Nothing added in this phase makes a network request.

---

# Block Outcomes as Board-State Branches

**Status:** Shipped. The resolution engine (`blockBranching.ts`), tree
evaluation and replay primitives (`blockBranchTree.ts`, `branchReplay.ts`), run
model (`branchRun.ts`, `useBranchRun.ts`), UI, and server-side score validation
are the standard block model. Player-facing board states are called **Parallel
Universes**; the old checklist, experimental preference, and feature flag have
been removed. Lockstep replay stops before an action that would add a roll in a
sibling universe, leaving that board untouched and marked **Needs a plan**.
Supersedes the outcome-checklist design in *Block and Blitz Actions* (see
"Design: modeling block dice inside the probability-tracking model", marked
superseded there).

## Problem Statement

The shipped outcome checklist asks the player which block faces they would
"accept" as the block succeeding, then applies exactly one of them to the board.
That is a stopgap, and the part that is wrong is specific: **it lets the player
choose what the dice did.** In a real game you do not choose; you get a result
and then decide what to do about it.

It also cannot express the two situations that motivate this whole feature,
because neither of them maps onto a contiguous set of die faces:

- *"I just need this defender out of my carrier's lane."* Satisfied by the two
  pushed states — but the defender still projects a tackle zone from wherever it
  lands, so the follow-on move may still need a dodge.
- *"My blitzer has Block and I need the tackle zone gone."* Satisfied by the two
  down states — and one of those (Both Down against a defender without Block)
  does not vacate the square at all.

"Push Back" and "Defender Down" are the same face-set in neither case. Thinking
in faces is the bug. Thinking in **resulting board states** is the fix.

A second, subtler problem: with 2 or 3 dice the picking side chooses a die
*after seeing the roll*. That is a decision made under information — a max node,
not a chance node. The checklist approximates it with a static accept/reject
mask declared before the roll. That approximation is why the model has never
been able to say anything true about a puzzle with more than one block in it.

## What the engine already gets right

Worth stating, because it bounds the change. Every other roll in the game —
dodge, GFI, pickup, catch, pass — has exactly one live branch: you succeed and
play continues, or you fail, the turn is over, and that line is worth zero.
That is why `pendingProb *= p` has always been correct.

**A block die is simply the first roll with more than one live branch.** This is
not a new system bolted onto the side of the engine; it is the general case of
what the engine already does. Dodges and GFIs keep multiplying exactly as they
do today — they are the degenerate one-branch case and need no changes.

## The model

### Branches carry weight

Replace the single `GameState` with a **branch set**. Each branch holds:

| Field | Meaning |
| --- | --- |
| `state` | a full `GameState` — board, ball, log, activation |
| `weight` | P(reaching this branch), with every prior roll folded in |
| `status` | `following` \| `diverged` \| `needs-attention` \| `scored` \| `conceded` |
| `id`, `parentId` | tree structure |
| `label` | derived from the board states that created it |

**Score = Σ weight over branches whose status is `scored`.**

**Weight is derived, never stored.** It cannot be assigned when the block splits,
because how often each board happens depends on what each one turns out to be
worth, which is not known until it has been authored. So the branch set is a
tree evaluated in two passes — values bottom-up, weights top-down — and the
score is the root's value, which is also exactly the summed weight of the lines
that reach a touchdown. `branchSummary` asserts that identity rather than
assuming it.

That is the whole scoring rule. Today's multiplicative score is the special case
where the set never grows beyond one branch. Failure branches (failed dodge,
Attacker Down) are never materialised — they are worth zero and there is nothing
to author in them — so live weights sum to less than 1, and the shortfall is
exactly the accumulated dead mass. That shortfall is directly displayable:
*"this line is already dead 31% of the time."*

### Faces collapse into board states at creation

The face-to-state mapping, with skills resolved up front:

| Face(s) | Weight | Resulting board state |
| --- | --- | --- |
| Attacker Down | 1/6 | attacker falls → turnover → **dead, not materialised** |
| Both Down | 1/6 | depends entirely on Block/Wrestle — see below |
| Push Back | 2/6 | defender pushed, **standing** |
| Defender Stumbles | 1/6 | same board as Push if defender has Dodge and attacker lacks Tackle; otherwise same board as Defender Down |
| Defender Down | 1/6 | defender pushed **and down** |

Both Down resolves to a live state only when the attacker has Block:

| Attacker | Defender | Result |
| --- | --- | --- |
| Block | Block | nobody falls — **board unchanged** ("no effect") |
| Block | no Block | **defender down in place, not pushed**; attacker stands |
| no Block | any | attacker falls → turnover → **dead** |
| Wrestle (no Block) | any | both placed prone → attacker down → turnover → **dead** |

So for the canonical case (attacker has Block, defender has no Dodge), five
faces collapse to **three live board states plus one dead one**:

| Board state | Weight |
| --- | --- |
| defender down in place, square not vacated | 1/6 |
| defender pushed, standing | 2/6 |
| defender pushed and down | 2/6 |
| *(dead — attacker down)* | *1/6* |

Stumbles and Defender Down are literally the same board once skills resolve, so
they merge on creation rather than being tracked separately and reconciled later.

### The picker is a max node, and it has a closed form

With N dice the picking side sees N faces and takes one. Since only the
resulting board state matters, the optimal policy is a **preference ordering
over board states**: take the best available one.

The player does not author that ordering. The engine **derives** it, because it
already knows what each branch is worth once its continuation is authored:

1. Enumerate the live board states `S₁…Sₖ` with their face weights.
2. The player authors a continuation from each (or concedes it → `V = 0`).
3. `V(Sᵢ)` = that subtree's conditional probability of scoring.
4. Sort by `V` descending; dead states sort last at `V = 0`.
5. Weights follow in closed form. With `qₖ` = summed face-probability of states
   ranked *k or worse* and `rₖ` = summed face-probability of states ranked
   *k or better*:
   - **attacker picks:** `P(Sₖ) = qₖᴺ − qₖ₊₁ᴺ` (all dice at rank ≥ k, minus all strictly worse)
   - **defender picks:** `P(Sₖ) = rₖᴺ − rₖ₋₁ᴺ` (mirror — the defender takes the worst)
6. Node value = `Σ P(Sᵢ) · V(Sᵢ)`.

No enumeration of the 21 unordered dice pairs is needed, and this is provably
the optimal policy — greedy argmax per roll is optimal when the choice is made
with full knowledge of the roll and nothing downstream depends on which physical
die was used.

**This strictly generalises the shipped formula.** Set `V = 1` for the accepted
faces and `V = 0` for the rest: the ordering puts all accepted states above all
rejected ones, and step 5 reduces to `1 − (1 − p)ᴺ` for attacker-picks and `pᴺ`
for defender-picks — exactly `blockCombinedProbability`. The checklist was a
crude, player-authored, binary special case of the ordering the engine can now
work out for itself.

One consequence to design the UI around: **branch weights move while you
author.** Writing a better contingency for the Push branch can make the
Defender Down branch *less* likely, because the attacker would now sometimes
prefer the push. That is not a glitch — it is the actual game — and it is the
single most instructive thing the tool will show.

### Merging

After every committed action, hash each live branch and fold equal hashes
together, summing their weights.

Hash over: sorted `(pieceId, col, row, down, activated)`, ball position or
carrier id, `blitzUsed`, `passUsed`, `blitzResumeId`, `selectedPieceId`, and —
only while an activation is open — `remainingMa` / `remainingGfi`.

Merging is always sound: if the board is identical, any continuation legal in
one branch is legal in the other. Reconvergence is common in practice — the two
"defender is down" states differ only in which square the defender occupies, so
they merge the moment the plan stops caring about that square. The surviving
branch keeps a compound label (*"Pushed + Down / Down in place"*) and both logs
are retained for display. This is what keeps a three-block puzzle from being 27
independent authoring jobs.

## Authoring: free navigation

The checklist is gone, but not the dialog. A block still shows a modal before
it progresses: large dice cycling through all possible faces; base ST plus
assists and effective ST versus effective ST; whether the resulting dice are
even, uphill, or downhill; and the resulting board-state split. Each outcome
names the faces that lead to it, including every face grouped under Turnover.
The heading is **Possible outcomes**, not language about choosing which result
counts. There are no checkboxes and no outcomes to configure; **Progress**
splits the branch set and Cancel backs out.

The split shown in that dialog is computed by valuing every live board state
equally (nothing has been authored yet, so nothing else is knowable) — which
is exactly the split the branch strip itself shows the instant the dice are
rolled. The dialog says plainly that authoring will move these numbers, so a
pre-roll figure never reads as a promise.

**Lockstep replay.** An action authored while viewing one branch is attempted in
every branch still in lockstep with it (same authored action sequence since
divergence):

- **Legal with no additional rolls** → applied, with roll targets recomputed
  against *that* branch's board. Equal roll counts can have different targets
  and odds without forcing separate authoring.
- **Adds a roll there** → none of that action is recorded on the sibling. It
  leaves the group at its pre-action state and is flagged `needs-attention`, so
  the player chooses its path separately.
- **Illegal there** → likewise leaves the group untouched and flagged
  `needs-attention`.

So a typical block costs zero extra authoring, and pulls you in precisely when
your plan genuinely breaks.

**Navigation is free.** A branch strip is always visible and always clickable:
one chip per live branch showing label, weight, current `V`, and status. Author
in whatever order you like. Switching branches ghosts the board — only pieces
whose position or down-state differs from the branch you were just in are drawn
as ghosts, so the overlay stays readable instead of turning to soup.

**Submit is gated** on every live branch being terminal: `scored`, `conceded`,
or dead. Conceding is one click and costs no authoring; it just contributes
zero. The branch strip doubles as the to-do list.

**Rollback.** Cancelling an activation rolls back across the entire lockstep
group, not just the viewed branch — `activationSnapshot` and `activationLogStart`
become per-branch, restored as a set.

**Push square and follow-up stay in-branch player choices, not branches.** Only
dice fork the world. This is a deliberate line: pushing is a genuine free choice
made with full information, and forking on it would multiply the tree by 3 for
no gain in truth.

## Scoring, validation, migration

- **Score becomes honest expected value.** A branch you cannot handle drags the
  number down by its weight. That is the point of the change.
- **`diceCount` tie-break generalises to expected dice count** — the
  weight-weighted mean over leaves. Fewest-dice-wins is preserved in spirit and
  stays comparable within the new model.
- **`shared/scoreValidation.js` must be rewritten.** `validateMoves` currently
  asserts the claimed probability equals the *product* of per-move `actionProb`
  (`shared/scoreValidation.js:161`). A policy score is a sum over leaves, so
  submissions carry a branch tree and the validator recomputes it: per-node
  face groupings against the recorded ST/skills, the derived ordering, the
  closed-form weights, then `Σ` scoring-leaf weights against the claim. Keep the
  existing posture — this catches nonsense, it is not a cheat-proof boundary.
- **No leaderboard migration.** Existing entries are test data and will be
  deleted by hand before release. Nothing needs snapshotting, and no clearing
  script is required.

## Feature flag

The change is too large to land in one piece, so it ships dark and is opted into
per player from Settings → Experimental.

- **`PlayerPrefs.blockBranching`** in `client/src/prefs.ts`, defaulting to
  `false` (i.e. today's outcome checklist). It lives alongside the other display
  preferences: `localStorage`, keyed by identity, junk-tolerant.
- **It is a build-in-progress flag, not a taste setting.** The two models score
  differently, so a run made under one is not comparable to a run made under the
  other. The Settings copy says so.
- **The flag gates the block resolution path only.** Everything upstream of a
  block — movement, dodges, GFI, pickup, pass, handoff — is identical either
  way, because those rolls already have exactly one live branch.
- **A run is not allowed to straddle the two models.** The flag is read once
  when a puzzle is opened and held for that attempt; toggling it mid-puzzle does
  not take effect until the next attempt.
- **Removing the flag is the last step**, once the branching path is the only
  one worth playing. The checklist code (`BlockOutcomePanel.tsx`,
  `isBlockOutcomeSelectable`, the checklist role of `blockCombinedProbability`)
  is deleted at that point, not before.

## Non-goals

- Chain pushes, crowd pushes, armour/injury rolls, standing up — all still out,
  as in the shipped section.
- Guard, Frenzy, Juggernaut, Stand Firm — still out. Block, Wrestle, Dodge and
  Tackle are the only skills that affect the face-to-state mapping.
- No opponent turn. A puzzle is still exactly one turn.
- No branching on push square or follow-up.
- No branch-count cap and no weight-floor pruning: the score is always exact.
  Merging is the only thing keeping the tree small, and it is enough.

## Acceptance Criteria

1. With attacker Block vs defender no-Dodge on 1 die, a block produces exactly
   three live branches weighted 1/6, 2/6, 2/6, and live weights sum to 5/6.
2. Setting `V = 1` on a set of states and `V = 0` on the rest reproduces
   `blockCombinedProbability` exactly for all `diceCount` × `picker`
   combinations — asserted as a property test against the existing function
   before it is retired.
3. Both Down against a defender *with* Block and an attacker *with* Block yields
   a single "board unchanged" state; against an attacker without Block it is not
   materialised at all.
4. A move authored in one branch is applied to lockstep siblings only when it
   adds no extra roll. A sibling where a standing defender introduces a dodge
   keeps its pre-move board and becomes `needs-attention`; equal roll counts may
   still recompute to different targets and odds per branch.
5. Two branches reaching an identical board hash merge, and the merged weight
   equals the sum of the two.
6. Improving a conceded branch's continuation visibly changes the *weights* of
   its siblings under a 2-dice attacker-picks block.
7. Submit is blocked while any branch is non-terminal; conceding all
   non-terminal branches unblocks it.
8. The server validator accepts a correctly computed tree and rejects one whose
   claimed probability, node weights, or orderings disagree.
9. Cancelling an activation restores every branch in the lockstep group.

## Implementation Approach

Sequenced so each phase is independently testable and nothing lands half-wired.

0. **Feature flag** — `PlayerPrefs.blockBranching` plus the Settings →
   Experimental toggle, defaulting off. Lands first so every later phase has
   somewhere dark to land. **Done.**
1. **Pure resolution engine** — `client/src/blockBranching.ts`:
   `blockBoardStates` for the face-to-board collapse, `blockStateProbabilities`
   for the ordering/weight closed form, `blockNodeValue` for the folded value.
   Headless, no UI, no state changes. The property test asserting the binary
   case reproduces `blockCombinedProbability` (criterion 2) lands here. **Done.**
2. **Branch set in `useGameState`**, split in two because the pure half stands
   on its own:
   - **2a — evaluation and replay primitives. Done.**
     `client/src/blockBranchTree.ts` is the authoring tree and its expectimax
     evaluation; `client/src/branchReplay.ts` is `boardHash` (the merge key)
     plus lockstep replay. `handleSquareClick` is split into `classifyClick`
     (what a click *means* on a board) and pure appliers, so a click can be
     replayed into a sibling and checked for still meaning the same thing.
     `addedRollCount` then prevents a legal candidate from advancing when it
     adds more roll tests than the viewed action.
   - **2b — the run itself. Done.** `client/src/branchRun.ts` holds a tree of
     board states instead of one `GameState`: `splitOnBlock` replaces the
     checklist with one branch per live board state, `clickSquare` /
     `choosePush` / `cancelActivation` author the viewed branch and replay into
     its lockstep group, and `concedeBranch` / `selectBranch` / `branchStrip`
     cover navigation. `client/src/useBranchRun.ts` is the React wrapper, thin
     enough that everything worth testing is tested without React.

   - **2c — group-aware declarations. Done.** Every handler in `useGameState`
     now delegates to an exported pure applier, and `branchRun.ts` routes each
     through the lockstep group: `declareBlock` / `chooseBlockTarget`,
     `declareHandoff` / `chooseHandoffTarget`, `declarePass` /
     `choosePassTarget`. Dice count, catch targets and pass targets are all
     recomputed per branch, so one authored hand off can be a bare catch in one
     branch and a marked one in another.

     `splitOnBlock` splits **every** branch in the group that has a block
     pending, not just the viewed one, since the declaration reached all of
     them. All the resulting children join a single lockstep group, so a second
     block leaves nine branches still following one authored plan.
3. **Merging** — apply `groupByBoard` to fold reconverged branches, which turns
   the tree into a DAG and means evaluation has to memoise by node identity and
   accumulate incoming weight before descending. Deliberately sequenced *after*
   the hook: merging changes how much authoring a puzzle costs, not what it
   scores, so nothing upstream depends on it being in place.
4. **UI. Done.** `BranchStrip.tsx` (live branch chips with derived weights,
   status, and a one-click concede), branch ghosts on the pitch, and
   `BranchRunSummary.tsx` for the end of a run. `App` instantiates both models
   and picks between them; the preference is frozen per attempt by
   `useBlockBranchingForAttempt`, and a board reset reaches both so switching
   models between attempts cannot land on a stale board.

   Two things the overlay learned from actually being looked at. A ghost drawn
   on the square the piece already occupies says nothing — those are prone-state
   differences, and they render as a corner pip instead, loud when the piece is
   still *standing* in the other branch, because that is the tackle zone the
   viewed board does not have. And expected dice is averaged over the lines that
   score, so a run scoring nowhere has nothing to average and hides the row
   rather than reporting a flat 0.0.

   **Submission is deliberately disabled under the flag.** A policy score is a
   sum over branches and `shared/scoreValidation.js` still checks a product, so
   a branching run shows its number and says why it stops there rather than
   posting one the server would reject. Phase 5 lifts this.

   **Every branch is labelled by the block that created it, not just its board
   state.** A bare state name like "Pushed" is not an identity — any block can
   produce a Pushed branch, so a puzzle with two blocks in it produces leaves
   that share a short label while meaning entirely different things.
   `branchPath` walks a line back to the root, collecting `attacker ⚔
   defender: state` at every split it passes through and joining them with
   `→`, e.g. `"Cedric ⚔ Muzgash: Pushed → Bramm ⚔ Dorg: Push Back"`. This is
   what the branch strip, the ghost-overlay tooltips, and the run summary all
   show — `RunLine.label` stays the bare state name underneath, since that is
   still what internal lookups and the submission tree key off; `path` is
   purely the display form.

   **Each branch in the run summary opens its own play-by-play.** Clicking a
   row swaps the same dialog to that branch's `ActionLogDetail` — the play
   diagram and move table, sourced straight from `run.lines[id].state.actionLog`
   — with a Back control returning to the branch list and the submit controls.
   `ActionLogDetail` is extracted out of `SubmitModal`, which now renders it
   too, so the single-line and branching models show a move genuinely the same
   way instead of two components maintaining the same table by hand.
5. **Scoring. Done.** A branching run submits the tree it was scored from, and
   the server recomputes it. `shared/blockWeights.js` holds the closed form so
   client and validator reach the identical number — two implementations would
   disagree in the last decimal place and start rejecting honest scores, so the
   client engine is now a typed wrapper over it.

   `validateBranchTree` recomputes the score two independent ways — the root's
   value, and the summed weight of the lines that reach a touchdown — and
   requires them to agree. Those are different walks of the tree (values
   bottom-up, weights top-down), so satisfying both establishes a coherence a
   single check would not. It also enforces that each block's faces add up to a
   die, that every board state has a branch, and that each segment's rolls
   multiply to the segment probability it claims. Same posture as the flat
   validator: it catches nonsense, it is not a cheat-proof boundary.

   `diceCount` is a weight-weighted mean over the scoring lines and is therefore
   fractional; the leaderboard formats it to one place. A branch still being
   authored serialises as conceded, so a partial run is never scored higher than
   it earned.

   The round trip is asserted in `branchRun.test.ts` against the real validator:
   what the player is shown is what the leaderboard recomputes.
6. **Flag removal** — delete `BlockOutcomePanel.tsx`,
   `isBlockOutcomeSelectable`, the checklist role of
   `blockCombinedProbability`, and the preference itself.

The model is complete behind the flag — playable, scored, and submittable.
What is left is cleanup (6).

# Review Completed Series Board

**Status:** Shipped.

The series touchdown analysis includes **Review Board**, which temporarily
reveals the final pitch without saving the result or advancing to the next
puzzle. A persistent **View Analysis & Continue** control returns to the same
analysis, so score submission and series progression still happen through the
existing guarded flow.

---

# Tutorial Series and Parallel Universes Onboarding

**Status:** Shipped.

## Goal and Decisions

Turn the current default series into a six-drill tutorial. Each puzzle in a
Tutorial run and the matching Single Play opens with a rules briefing. Editor
previews do not show these briefings.
Graduate the shipped block-branching engine from an experimental opt-in to the
only block-resolution model and call its player-facing board states **Parallel
Universes**.

The following decisions are fixed for this implementation:

- Keep the featured series title **Humans vs Orcs: The Nuffle Shuffle** and
  label it **Tutorial** in the challenge screen.
- Give the featured series a dedicated chooser logo; series definitions carry
  an optional stable logo key so future series can provide their own artwork.
- Order its puzzles `scenario-001`, `scenario-004`, `scenario-002`,
  `scenario-003`, `scenario-005`, `scenario-006`.
- Show lesson dialogs in `series-puzzle` mode and when the same scenario is
  opened through Single Plays. Editor previews remain excluded.
- Disable action-menu choices until their tutorial drill introduces them:
  Movement/Dodging expose Move, Hand-off adds Hand-off, Pass adds Pass, The
  Drive keeps those three, and Blocking/Parallel Universes adds Block and
  Blitz.
- Parallel Universes is standard for every puzzle mode and every player. Remove
  the old block-outcome checklist and the experimental preference; this is not
  a gameplay option once this plan ships.
- Settings controls rules briefings only. Turning briefings off must not turn
  Parallel Universes or any other game rule off.

## Tutorial Experience Requirements

### Entry, frequency, and persistence

- When a Tutorial run starts or advances to its next puzzle, initialize the
  puzzle first and then open that puzzle's lesson before the pitch accepts
  input. The dialog is not part of the scored action log and must not alter or
  restart either the puzzle or series run.
- A lesson appears once per identity on the current device. Store its stable
  lesson/scenario id in the existing identity-keyed, junk-tolerant
  `bbt.prefs.v1` record. Google users remain keyed by subject id and guests by
  `GUEST_PREFS_KEY`.
- Closing or continuing from a lesson records that lesson as seen. Restarting
  the current puzzle, reviewing its completed board, visiting Settings, or
  leaving and starting another Tutorial run must not redisplay an already-seen
  lesson.
- Every lesson includes a checkbox labelled **Do not show these rules briefings
  again**. Continuing with it checked disables all later Tutorial lesson
  dialogs for that identity, including unseen lessons.
- Add a normal (not Experimental) **Rules briefings** switch in Settings.
  It defaults on for identities without a stored value. Switching it off
  suppresses all lesson dialogs. Switching it back on clears the seen-lesson
  list so the lessons can be replayed from the start on the next Tutorial run.
- Reads must tolerate missing, malformed, duplicated, or obsolete lesson ids.
  Writes must keep a deduplicated bounded list containing only current lesson
  ids. Existing preference records, including a stale `blockBranching` field,
  must continue to load without breaking Settings.

### Dialog behavior and accessibility

- Add one reusable, focus-trapped `TutorialLessonDialog`, using the same modal
  shell and `useModalFocus` behavior as existing dialogs: `role="dialog"`, an
  accessible title, initial focus inside, trapped Tab navigation, Escape as a
  normal dismissal, and focus restoration to the control that started or
  advanced the run.
- Show `Tutorial Drill N / 6`, a rules title, labelled instruction blocks,
  the opt-out checkbox, and a primary **Begin Puzzle** action. Escape dismissal
  counts as seen but never silently opts out of later lessons.
- The `scenario-006` briefing shows the pointed Parallel Universes decision
  tree above its rules copy. Other briefings remain text-only. The artwork must
  have descriptive alternative text, stay within the dialog at every supported
  viewport, and preserve access to the opt-out and **Begin Puzzle** controls by
  internal scrolling.
- Dialog copy must explain controls and scoring without prescribing one exact
  route. It must fit a 320 px-wide viewport with internal scrolling, no page
  overflow, and no dependence on hover-only explanations.
- Keep lesson content in a typed, React-free module keyed by stable scenario
  id. Do not put title/description overrides in it: scenario JSON remains the
  source of truth for scenario names and descriptions.
- If a published Tutorial series contains an unknown scenario id or a known
  scenario without lesson content, play must continue without a dialog. A
  missing lesson must never make a published series unplayable.

### Required lesson content

The implementation may tighten phrasing for the available space, but it must
preserve every fact below and add no unsupported Blood Bowl rules.

| Step | Puzzle | Concept and required explanation |
| --- | --- | --- |
| 1 | `scenario-001` | **Movement.** State the objective, one-activation limit, route preview, MA, Rush and Dodge tests, and probability score. |
| 2 | `scenario-004` | **Tackle Zones and Dodging.** State when a Dodge is required, how extra Tackle Zones affect it, how the route shows tests, Sera's Dodge reroll, and how failure reduces the score. |
| 3 | `scenario-002` | **Hand-off Action.** State the action order, Catch roll, receiver activation rule, and shared Pass or Hand-off limit. |
| 4 | `scenario-003` | **Pass Action.** State the action order, PA test, Catch roll, preview modifiers, receiver activation rule, and shared Pass or Hand-off limit. |
| 5 | `scenario-005` | **The Drive.** State the activation limit, order-of-play requirement, cumulative risk, one-turn limit, and prohibition on resetting the probability chain. |
| 6 | `scenario-006` | **Blocking and Parallel Universes.** Show the decision-tree artwork. State Block and Blitz movement rules, Blitz limit, ST and assists, dice ownership, live universes, Turnover probability, universe controls, completion rule, final score, and Pickup rules. |

## Parallel Universes Graduation

### Player-facing language

- Use **Parallel Universes** as the feature/concept name and **universe** for a
  playable resulting board. Replace player-visible `branch`, `branching`,
  `board-state branch`, and `block outcome branching` language in the live
  strip, hints, buttons, summaries, tooltips, accessible names, Settings, and
  errors. Natural rules terms such as **Possible outcomes** and the names of
  die faces remain unchanged.
- Examples include **N universes unresolved**, **Resolve every universe. Score
  or give it up.**, **Universes scored: N of M**, and ghost descriptions such
  as **occupied in other universes**.
- Internal TypeScript names (`BranchRun`, `branchSummary`, submission `tree`,
  and related filenames) may remain technical implementation terminology.
  Avoid a risky mechanical rename that adds no player value.

### One standard rules path

- Remove `PlayerPrefs.blockBranching`, `useBlockBranchingForAttempt`, the
  Settings Experimental block toggle, conditional dual-model selection in
  `App.tsx`, `BlockOutcomePanel`, and checklist-only outcome-selection
  helpers/handlers once no production caller remains.
- Use `useBranchRun` as the single application game model. Before the first
  block it behaves as the existing one-line game, so movement, dodge, pickup,
  pass, handoff, cancel/rollback, probability preview, and the one-turn rule
  remain unchanged.
- Keep the declare-time `BlockSplitPanel`, but present it as the preview before
  entering Parallel Universes. Preserve ST/assist math, dice ownership,
  face-to-board collapse, turnover mass, lockstep replay, merging, conceding,
  ghost boards, expected-value scoring, and server recomputation already
  specified in *Block Outcomes as Board-State Branches*.
- Existing stored `blockBranching: false` values are ignored after migration;
  no player can retain the obsolete checklist model. No leaderboard wipe or
  data migration is part of this change.

### Completion and leaderboard compatibility

- Graduation must work in both standalone and Tutorial series play. The
  current experimental path only completes/submits a tree correctly in
  standalone mode; it must not let the first universe that reaches the end zone
  prematurely advance a series puzzle.
- A run completes only when all live universes are scored or given up. A
  one-line/no-block run completes normally when that line scores.
- Use the normal touchdown analysis for a run that never splits. Use the
  Parallel Universes summary when at least one block created multiple live
  boards; retain per-universe play-by-play and Review Board behavior.
- Individual leaderboard submission must send the representation its validator
  expects: a validated tree for a Parallel Universes run, while an unsplit run
  may continue using the flat payload if that avoids needless storage/display
  migration.
- Extend `SeriesPuzzleResult`, the series API payload, and
  `shared/scoreValidation.js` so a series puzzle that used Parallel Universes
  carries and validates its tree as an individual submission does.
  Recompute its probability and expected dice from that tree; do not pass the
  root score through the existing flat `validateMoves` product check.
- Series aggregate probability remains the average of its six validated
  puzzle probabilities. The tie-break becomes the sum of per-puzzle dice
  counts, which can be fractional because a Parallel Universes puzzle uses
  expected dice. Update numeric validation and display formatting accordingly
  without weakening finite/range checks.
- Best-effort submission to the individual puzzle leaderboard and final series
  submission must use the same computed probability/tree. A failure in the
  individual write remains a surfaced non-blocking notice and must not discard
  Tutorial progress.

## Constraints and Non-goals

- A puzzle is still exactly one turn. Do not add End Turn, turn counters,
  halves, a running match score, or Free Play.
- Do not change scenario formations, ids, or rules-engine math. Scenario names
  and descriptions may change under the full-game copy audit below.
- Do not show automatic lesson dialogs in Single Plays, editor previews,
  leaderboards, settings, or completed-board review.
- Do not add a server account setting or sync tutorial progress between
  devices. This follows the existing local, identity-keyed display preference
  architecture.
- Do not put tutorial fields into scenario JSON or shared scenario validation.
  Lessons are product guidance, not published puzzle definitions, and must not
  create client/server/editor schema drift.
- Do not make Parallel Universes optional, tutorial-only, or dependent on the
  tutorial-guidance setting.
- Rules simplifications already documented for blocking remain in force: no
  chain/crowd pushes, armour/injury, Guard, Frenzy, Juggernaut, or Stand Firm.
- `shared/` remains dependency-free. Any series tree validation added there
  must reuse its existing plain ESM helpers and import no package.

## Architecture

| Area | Responsibility |
| --- | --- |
| `client/src/series/default.json` | Keep the featured title, use the Tutorial label in the challenge screen, and list the six drills in the decided order. |
| New `client/src/tutorialLessons.ts` | Own the closed lesson/scenario id mapping, ordered typed content, current-id sanitization helpers, and lookup. No React and no alternate scenario titles. |
| New `client/src/TutorialLessonDialog.tsx` plus scoped CSS | Render the accessible, responsive lesson modal and global opt-out checkbox. |
| `client/src/prefs.ts` | Persist only the explicit `showTutorialGuidance` choice; ignore obsolete `seenTutorialLessons` and `blockBranching` on sanitized reads. |
| `client/src/SettingsScreen.tsx` | Add the Rules briefings switch and remove Experimental block settings. Re-enabling resets seen lessons. |
| `client/src/App.tsx` | Open lessons only at Tutorial puzzle entry/advance, record dismissal/opt-out, use one `useBranchRun` model, and route flat versus Parallel Universes completion correctly for standalone and series play. |
| `client/src/BranchStrip.tsx`, `BranchRunSummary.tsx`, `Pitch.tsx`, `BlockSplitPanel.tsx` | Adopt player-facing universe terminology while preserving the proven internal branch model and calculations. |
| `client/src/types.ts`, `client/src/api.ts`, `shared/scoreValidation.js` | Carry optional per-puzzle submission trees through series results and validate/aggregate tree scores and fractional expected dice without client/server drift. |
| Existing/new focused tests | Cover lesson gating/persistence/order/accessibility, standard-universe gameplay, obsolete-pref migration, and individual/series tree submission. |
| `docs/agent-context/*.md` | After shipping, record Tutorial entry behavior/preferences in `frontend-flow.md`, order/content ownership in `scenarios-and-series.md`, and standard Parallel Universes rules in `game-rules-engine.md`. |

## Implementation Steps

1. Add typed lesson content and preference sanitization tests. Extend
   `PlayerPrefs` with Tutorial guidance/seen ids, define off/on/reset behavior,
   and drop the obsolete block flag during sanitization.
2. Build the accessible lesson dialog and tests for focus, Escape, continue,
   per-lesson seen state, global opt-out, and compact overflow. Wire it only to
   `startSeries` and series advancement; verify standalone/editor entry never
   opens it.
3. Rename/reorder `default.json` and update series/select tests to assert the
   exact `1, 4, 2, 3, 5, 6` resolved order and six-step counter.
4. Make `useBranchRun` the sole game path. Remove the experimental Settings UI,
   attempt-frozen preference, checklist rendering and dead checklist code, then
   update all player-visible text to Parallel Universes.
5. Unify completion handling so unsplit runs retain the ordinary analysis and
   split runs use the universe summary in both standalone and Tutorial modes,
   including Review Board, restart, leave-series confirmation, and progression.
6. Extend series result serialization and dependency-free shared validation to
   accept and recompute per-puzzle trees and fractional expected dice. Add
   rejection tests for altered root values, weights, orderings, probability,
   and dice totals, plus a real scenario-006 Tutorial round trip.
7. Remove unused imports/components/helpers, regenerate only outputs produced
   by normal build scripts, and update the three durable context docs.
8. Run `npm run verify`. Because this touches gameplay modal/layout and compact
   HUD behavior, also run `npm --prefix client run test:e2e:mobile` after browser
   binaries are available and manually exercise a complete Tutorial run at
   desktop and 320 px width.

## Success Criteria

- The home screen labels the featured series **Tutorial**, shows the title
  **Humans vs Orcs: The Nuffle Shuffle**, and starting it plays scenarios
  `001`, `004`, `002`, `003`, `005`, `006` with correct counters.
- Each unseen lesson appears before its Tutorial puzzle is interactive, once
  per identity/device; it never appears from Single Plays or editor preview.
- Dismissing records only the current lesson, the dialog checkbox disables all
  future lessons, Settings can disable them, and re-enabling resets the lesson
  history so the Tutorial can teach from the beginning again.
- All six dialogs contain the required rules/control explanations and remain
  keyboard- and screen-reader-usable on desktop and compact layouts.
- Every player uses the Parallel Universes block model regardless of old stored
  preferences. The old checklist, experimental setting, and runtime flag are
  absent, and no player-facing branch terminology remains in this feature.
- Scenario 006 can split into universes during a Tutorial run; one universe
  scoring does not advance the puzzle, all universes must resolve, and the
  validated expected-value result advances and submits correctly.
- Standalone and series leaderboards accept honest flat and universe runs,
  reject tampered trees/aggregates, retain personal-best behavior, and format
  fractional expected dice consistently.
- Movement, pass, handoff, dodge, pickup, block math, cancellation, one-turn
  behavior, settings return-to-game behavior, and published scenario fallback
  continue to work.
- `npm run verify` and the mobile Playwright suite pass, with no unused symbols,
  shared-package imports, generated-seed hand edits, or 320 px overflow.

---

# Engagement Analytics and Admin Graphs

**Status:** Shipped. The first-party dashboard is limited to game-specific activity and deliberately excludes traffic/audience data already available from Google Analytics.

## Goal and Product Decisions

Expand Admin Mode Statistics from retained leaderboard personal bests into a
privacy-limited product analytics dashboard that answers:

- how many game sessions start, meaningfully play, and complete a puzzle;
- how many puzzles and how much active play time occur per game session;
- which puzzles and Tutorial stages players complete, restart, leave, or stop
  partway through;
- which game actions, controls, briefings, settings, and submission paths are
  used.

The decided product policy is:

- Show the new reports and graphs in the existing admin-only Statistics screen.
- Collect the first-party analytics on production visits without a consent
  prompt, opt-out setting, or Do Not Track exception. The About/privacy copy
  must accurately disclose this behavior before release.
- Retain session-level records for 13 calendar months. Keep only anonymous
  aggregate daily totals after the corresponding session records expire.
- Keep the existing GA4 page tracking as-is, but do not duplicate anything it
  can already provide. The first-party dashboard contains game-specific puzzle,
  action, completion, drop-off, Tutorial, and interaction measures only. It does
  not collect or show visits, unique/returning visitors, referrers, campaigns,
  device/browser/OS, geography, or generic screen views, and it adds no GA4
  custom events or GA Data API dependency.

This work begins collecting data only when deployed. It does not infer or
backfill historical visits, attempts, or abandonment from personal-best
leaderboards or local attempt history.

## Measurement Definitions

All dashboard labels, API fields, tests, and CSV headings must use these
definitions consistently.

| Measure | Definition |
| --- | --- |
| Game session | One random session UUID created when game-specific activity is first recorded and retained across reloads in session storage. Rotate it after 30 minutes without a game analytics or user-activity event. Multiple tabs are separate game sessions; there is no persistent browser id. |
| Puzzle start | A published standalone or Tutorial puzzle has been initialized for play. Editor previews do not count. Each restart closes the old attempt and creates a new start. |
| Meaningful play | The first legal player-piece selection/activation or committed game action after initialization. Hover, scrolling, opening help, zoom, and dismissing a Tutorial briefing do not qualify. |
| Puzzle completion | The whole run reaches its real completion condition before any score-submission choice: a flat run reaches touchdown, or every live Parallel Universe is scored or given up. One universe scoring is not completion. |
| Incomplete attempt | A started attempt with no completion. Report terminal reasons separately as `restarted`, `left-puzzle`, `left-series`, `replaced`, or `inactive/closed`; do not present all of them as failures. |
| Inactive/closed | No explicit terminal event arrived and the attempt/session has been inactive for at least 30 minutes. This is an inference and must be labelled as such. `pagehide` delivery improves the signal but is not guaranteed. |
| Active time | Visible, foreground time reported in increments of at most 60 seconds while a puzzle attempt is active. Never treat a long wall-clock gap, a hidden tab, or time outside play as active play. |
| Engaged game session | A game session containing at least one meaningfully played puzzle. |
| Completion rate | Completed attempts divided by puzzle starts in the same cohort. Also show starts-to-engaged and engaged-to-completed rates so pre-play exits are not hidden. |
| Series completion | Every published puzzle in that particular Tutorial run completed and the series result reached its completion flow. Individual puzzle completions remain visible at each series position. |

The session ids are pseudonymous operational identifiers even though they
contain no direct identity. They may be used only for the aggregate
analytics in this section and must never appear in an admin API response,
dashboard table, log message, report download, leaderboard record, or GitHub
report.

## Event and Session Requirements

The client collector must expose typed, allowlisted events and reduce them into
bounded session summaries. It must not upload arbitrary component props or a
copy of game state.

### Required lifecycle events

- `puzzle-started`, `puzzle-engaged`, `puzzle-ended`, and `puzzle-restarted`,
  joined by a random attempt id and carrying only scenario id, current published
  scenario name for display fallback, standalone/Tutorial mode, Tutorial
  position, timestamps, and the normalized counters below.
- `series-started`, `series-advanced`, and `series-ended`, with a random run id,
  the published series id, stage number, and `completed`, `left`, `replaced`, or
  inferred `inactive/closed` outcome.
- Visible active-time ticks no more frequently than once per minute. The client
  must cap each increment at 60 seconds, batch transport, and stop ticks while
  the document is hidden or Admin Mode is active.
- Best-effort finalization and queue flushing on `visibilitychange` and
  `pagehide`, using `sendBeacon` where possible and `fetch(..., { keepalive:
  true })` as the fallback. Correct reporting must not depend on an unload
  request arriving.

### Required gameplay detail

For each attempt, retain bounded numeric counts rather than full action logs:

- player pieces selected and distinct pieces activated;
- committed move steps and normalized roll/action types: dodge, rush, pickup,
  hand-off, pass, catch, block, and blitz;
- blocks declared, Parallel Universe splits created, universes completed, and
  universes given up;
- activation cancellations, route/action cancellations, and restarts;
- latest normalized action type, committed-action depth, and activated-own-piece
  count at the terminal event;
- on completion only, final probability and expected/actual dice count, bounded
  by the same finite numeric limits used for scores but not treated as a trusted
  leaderboard submission.

The game models risk rather than simulating dice failures, so the dashboard must
not invent a "failed roll" measure. Its failure/exit breakdown consists of
incomplete-attempt reasons, score-submission failures, cancellations, restarts,
and conceded Parallel Universes.

### Required interaction detail

Record only allowlisted interaction names and coarse outcomes:

- Tutorial briefing shown, begin, dismiss/return, and guidance preference
  changed;
- Settings opened/closed and each supported setting key changed, with a boolean
  or closed enum value where useful;
- leaderboard opened; score dialog shown, submit attempted, submit succeeded,
  submit failed, retry, or submit skipped;
- report dialog opened/closed and report submission succeeded/failed, including
  only `issue` or `feature`, never its title, description, reporter, or download;
- About, game-tools, legend, action-log, and mobile-info panels opened/closed.

Do not collect pointer movement, hover targets, pitch coordinates, piece ids or
names, route geometry, move/action logs, report text, leaderboard names, error
stacks, or free-form error messages. Error outcomes use a short server-defined
enum such as `network`, `auth`, `validation`, `rate-limit`, or `server`.

### Explicitly excluded Google Analytics overlap

Do not collect a persistent browser id, generic visit/session start, identity
gate completion, screen views, referrer or UTM fields, device class, viewport,
browser, operating system, IP-derived location, country, or guest/signed-in
status. Those are traffic/audience concerns and are deliberately left to the
existing Google Analytics property.

## Collection, Validation, and Delivery

- First-party collection is enabled only in deployed production by default so
  localhost, editor previews, unit tests, and Playwright runs cannot pollute the
  store. Tests may inject an explicit collector/clock/transport.
- Analytics is non-critical. Initialization, storage, serialization, queueing,
  or network failures must never block identity, play, completion, navigation,
  or score submission and must not show a player-facing error.
- Keep a bounded retry queue at `bbt.analytics.queue.v1`: at most 200 events,
  drop oldest first, discard entries older than seven days, retry with bounded
  backoff, and send batches of at most 50 events and 64 KiB. Once formed, a
  failed batch retains the same random batch id across every retry.
- Ingestion must deduplicate processed batch ids so a beacon retry cannot
  double-count it. Events from two tabs remain separate because their session
  and attempt ids differ.
- `POST /api/analytics` is same-origin, public, accepts only the versioned
  allowlisted schema, and returns `202` after durable acceptance. Enforce method,
  content type, request size, enum, string-length, array-length, finite-number,
  UUID, and timestamp bounds before storage. Use server receipt time as the
  authority and reject timestamps implausibly in the future or older than the
  seven-day queue allowance.
- Add a dedicated analytics rate limit keyed through the existing trusted
  address adapter. The address can be used transiently for throttling but must
  never be written to an analytics record.
- Treat every count, session id, scenario id, and timestamp as untrusted.
  Analytics may inform product decisions but must never authorize a request,
  change game state, validate a score, or become a leaderboard source.

## Retention and Storage

Netlify Blobs is the production store. Express uses an in-memory equivalent for
local development and tests; local analytics need not survive a server restart.

- Persist one bounded session-summary document per session. The summary contains
  only normalized dimensions, counters, attempts/series outcomes, active-time
  totals, and processed batch ids needed for idempotency. It does not contain
  raw events or forbidden fields.
- Partition session keys by UTC start month so the admin query and retention job
  can list only relevant prefixes. Merge concurrent batches with conditional
  writes and bounded retry, following the existing leaderboard conflict pattern.
- A daily scheduled maintenance function recomputes closed UTC daily rollups
  idempotently from retained session summaries, reprocessing the previous seven
  days for late queued batches. Rollups contain aggregate counts and histograms
  only, with no session, attempt, batch, or event ids.
- The same maintenance job deletes session documents whose `lastSeenAt` is more
  than 13 calendar months old, after confirming the applicable daily rollups
  exist. A failed/missing rollup must defer deletion rather than silently lose
  long-term totals.
- The admin endpoint combines live session summaries for windows up to 365 days
  and daily rollups for a separate all-time game-activity trend. For the open UTC day,
  compute a provisional bucket from session summaries; use rollups only for
  closed days. It must not add both sources for the same day. Exact medians and
  funnels are available only from retained session data and must not be claimed
  for dates beyond that boundary.
- Analytics storage is independent of leaderboard, editor draft/published,
  managed-admin, and report stores. Session records age out under the 13-month
  policy.

## Admin Dashboard Requirements

Keep **Leaderboard Performance** visibly labelled as personal-best data and
render it even when engagement analytics fails. Add separate **Engagement** and
**Gameplay** sections backed by the new admin endpoint. Use
7-, 30-, 90-, and 365-day UTC windows for session-level reports and a separate
all-time aggregate game-activity view. Show the exact start/end dates and collection
start/retention caveat; do not label pre-launch zeroes as inactivity.

### Engagement

- Summary cards: game sessions, engaged sessions, puzzle starts, puzzle
  completions, completion rate, median active play time, and average puzzles
  started per game session.
- A time-series graph for game sessions, engaged sessions, starts, and
  completions; use daily buckets for 7/30 days, weekly buckets for 90/365 days,
  and monthly buckets for the all-time aggregate game-activity graph.
- An attempt funnel: Puzzle Started -> Meaningful Play -> Puzzle Completed. Show
  absolute counts plus conversion from the preceding and first stages.
- Active-time and puzzles-per-session distributions, so a mean cannot conceal a
  large one-and-done population.

### Puzzle and Tutorial drop-off

- A searchable/sortable per-puzzle table and horizontal funnel bars for starts,
  meaningful starts, completions, restarts, explicit leaves, inferred
  inactive/closed attempts, completion rate, and median active play time.
- A stop-depth graph for incomplete attempts using committed-action-depth bands
  `0`, `1`, `2-4`, `5-9`, and `10+`, with a companion breakdown by last
  normalized action and activated-own-piece count. These are interaction-depth
  signals, not claims about percentage of a puzzle solved.
- A Tutorial/series funnel from series start through each published series
  position to series completion, keyed by stable scenario id while displaying
  the current published name. Missing/deleted historical ids remain labelled by
  id instead of being discarded.
- Separate terminal reasons. A restart must not be merged with leaving the game,
  and a completed puzzle followed by skipping leaderboard submission remains a
  completion.

### Gameplay and interactions

- Horizontal bar charts for normalized action counts and per-engaged-attempt
  rates, including movement roll types, passes/hand-offs, blocks/blitzes, and
  Parallel Universe behavior.
- Restart, cancellation, universe-give-up, and submission-outcome charts.
- An interaction table for the allowlisted Tutorial, Settings, leaderboard,
  report, About, and help-panel events. Avoid ranking tiny counts as meaningful;
  show sample size beside each rate.

### Graph behavior and accessibility

- Prefer small inline SVG/CSS charts and shared chart primitives over a charting
  dependency. Use a dependency only if implementation proves the accessible
  behavior or required scale cannot be met without it.
- Every chart has a visible title, period, sample size, legend, axis/tick labels,
  and an adjacent exact-value table or disclosure. Its graphic has a concise
  accessible summary; no fact is available only through hover or color.
- Use the existing semantic palette with sufficient contrast, distinct marks or
  line styles, tabular numbers, keyboard-operable disclosures, and responsive
  layouts down to 320 px without page-level horizontal overflow. Wide exact-data
  tables may scroll inside their own labelled region.
- Loading, partial-error, empty, suppressed-small-sample, collection-not-started,
  and retention-limited states must be explicit. Refresh and window changes
  must not erase already rendered sections while a request is pending.
- Preserve the existing anonymous personal-best CSV. If analytics exports are
  added, export only the already aggregated rows returned to the dashboard;
  never export session-level records.

## Architecture

| Area | Responsibility |
| --- | --- |
| New `client/src/analytics.ts` and focused tests | Own production gating, random session/attempt ids, session timeout, bounded queue/batching, active-time clock, typed event helpers, lifecycle flush, storage fallbacks, and injected test seams. No persistent browser id, React, or game rules. |
| `client/src/App.tsx` plus narrow component callbacks | Emit lifecycle, attempt, series, completion, restart/leave, submission, Tutorial, settings, and panel events at existing authoritative transitions. Do not infer completion from rendering or instrument editor previews. |
| `client/src/api.ts` | Provide the non-throwing analytics batch transport, isolated from score/report requests. |
| New dependency-free `shared/analyticsValidation.js` / `.d.ts` | Define schema/version, enums, limits, sanitization, session reduction, abandonment rules, and forbidden-field behavior shared by Express and Netlify. Import no package. |
| New dependency-free `shared/analyticsStatistics.js` / `.d.ts` | Aggregate retained session summaries into game-activity time buckets, funnels, distributions, puzzle/series reports, and interaction rates. Keep it separate from leaderboard `statistics.js`. |
| `POST /api/analytics` in Express and a new Netlify function | Validate, normalize, rate-limit, idempotently merge batches, and return `202`. Express stores only in memory. |
| New Netlify analytics storage helper | Read/write month-partitioned session summaries with conditional retries, list required months, and expose deletion/rollup operations without changing leaderboard storage semantics. |
| New daily Netlify maintenance function | Rebuild recent UTC daily rollups, verify them, and remove session summaries older than 13 calendar months. It is not a public API route. |
| New admin-only `GET /api/editor/analytics` in both targets | Parse `window=7|30|90|365`, read only needed partitions, infer stale open outcomes, aggregate server-side, and return no record-level ids. Keep failure independent of `/api/editor/statistics`. |
| `netlify.toml` | Route public ingestion and admin analytics reads; keep the scheduled function internal. No new third-party CSP origin is required. |
| `client/src/editor/AdminStatistics.tsx` and scoped chart components/CSS | Preserve personal-best reporting and add game Engagement and Gameplay sections, graphs, accessible data views, responsive states, and independent loading/errors. |
| `docs/agent-context/netlify-deploy.md`, `puzzle-editor.md`, `frontend-flow.md`, and `testing-and-pr-workflow.md` | After shipping, record endpoints/storage/retention, dashboard semantics, instrumentation transitions, and test coverage. |

## Constraints and Non-goals

- A puzzle remains exactly one turn. Analytics must not add End Turn, turn
  counters, halves, score banking, running match scores, or Free Play.
- Do not change game probability/block math, completion rules, scenario data,
  leaderboard validation, personal-best retention, or local attempt history.
- Never copy this logic into divergent client/Express/Netlify variants. Shared
  validation and aggregation stay dependency-free and package imports remain in
  their resolving targets.
- Do not collect direct identity, persistent browser ids, traffic/acquisition/
  audience fields, raw network/device identifiers, location, navigation URLs,
  free-form text, pitch/move logs, or replayable game state. Do not build session
  replay, heatmaps, or an admin list of individual sessions.
- Do not promise perfect tab/session merging, guaranteed unload delivery, or
  exact abandonment at the moment a tab closes.
- Do not connect the new data to GA4, advertising, personalization, player-facing
  progress, auth/admin decisions, or leaderboard eligibility in this release.
- The always-on choice does not remove the need for accurate disclosure or the
  13-month deletion job. Any later consent/opt-out change must stop future
  collection without silently redefining historical dashboard metrics.

## Implementation Steps

1. Define the versioned analytics schema, measurement fixtures, privacy
   allowlist/forbidden fields, window semantics, reducer, aggregation functions,
   and handwritten TypeScript declarations in `shared/`.
   Add tests before wiring the client.
2. Build the production-gated client collector with random session/attempt ids,
   30-minute rotation, visible-time ticks, bounded durable queue,
   idempotent batches, lifecycle delivery, storage-unavailable fallback, and a
   no-op-safe transport.
3. Instrument authoritative transitions in `App.tsx` and the minimum child
   callbacks: published puzzle/Tutorial starts, first
   meaningful play, normalized actions, restarts, all completion paths,
   confirmed leaves, series stages, score/report outcomes, settings, and help
   panels. Verify editor previews and a single universe touchdown cannot emit a
   completion.
4. Add public ingestion to Express and Netlify with identical validation,
   normalization, rate limits, idempotency, server timestamps, and
   forbidden-field rejection. Add month-partitioned
   Netlify session storage with conditional retry.
5. Add daily rollup/13-month cleanup maintenance and tests for late batches,
   idempotent reruns, month boundaries, leap dates, rollup failure, and safe
   deletion. Seed local test fixtures; do not manufacture production history.
6. Add the independent admin analytics endpoint and aggregation contract for
   7/30/90/365-day reports plus all-time daily game activity. Cover stale-session
   inference, multi-tab sessions, restart versus leave, series stage order,
   renamed/deleted scenarios, and no-id response assertions.
7. Extend Admin Statistics with overview cards, trends, funnels, distributions,
   per-puzzle/Tutorial drop-off and gameplay/interaction views.
   Preserve the existing personal-best notice/table/CSV and make the two data
   sources fail independently.
8. Add accurate About/privacy disclosure and update the four durable context
   docs. Document collection start, definitions, always-on policy, production
   gating, 13-month detail retention, permanent aggregate rollups, and GA4's
   separate role.
9. Run `npm run verify` including function bundle checks. Run the full
   `npm --prefix client run test:e2e` matrix because the admin screen gains
   responsive graphs/tables, and manually exercise production-like batching,
   reload, tab close, inactivity, restart, flat completion, Parallel Universes
   completion, Tutorial abandonment, and retention maintenance.

## Success Criteria

- A production game session creates a random session id without a persistent
  browser id and without storing or returning a name, email, Google id, guest
  alias, IP, raw User-Agent, location, referrer/campaign, device/browser details,
  free text, move log, or board state.
- Reloading a tab continues its active game session, 30 minutes of inactivity
  rotates it, and another tab is a separate game session.
- The dashboard can answer game sessions, engagement, starts, completions,
  active time, puzzles per session, per-puzzle and Tutorial drop-off,
  restart/leave/inactivity reasons, actions, interactions, and submission
  outcomes for every supported window without duplicating GA traffic/audience
  data.
- Puzzle completion is recorded at real game completion, independent of
  leaderboard submission. Restarts create distinct attempts; editor previews,
  one scored universe, skipped submissions, hidden-tab time, and fabricated
  failed-roll metrics do not corrupt the funnel.
- Abandonment is explicitly split into observed exits and 30-minute inferred
  inactivity. Lost unload beacons do not leave open attempts permanently or
  count them as completions.
- Retried/out-of-order batches are idempotent, concurrent writes do not silently
  lose counts, invalid/oversized payloads are rejected, analytics failure never
  affects play.
- Session-level records older than 13 calendar months are deleted only after
  anonymous daily rollups exist. Aggregate all-time game activity remains
  available without stable ids.
- Admin API responses contain only aggregate results, remain admin-gated, and
  cannot expose an individual session. Existing personal-best statistics still render and stay accurately
  labelled if analytics is empty or unavailable.
- Every graph exposes its period, sample, definitions, exact values, and an
  equivalent accessible reading; it remains usable by keyboard and screen
  reader and at 320 px without page-level overflow or color-only meaning.
- Local development/tests do not pollute production analytics, no new third-party
  CSP origin or shared-module dependency is introduced, generated scenario seed
  files are untouched, `npm run verify` passes, and the full Playwright device
  matrix passes.

---

# Full-game Rulebook Copy Audit

**Status:** Shipped.

## Requirements

- Review every player-facing string in the client, including Tutorial dialogs,
  home, game status, logs, summaries, rankings, Settings, reports, Admin Mode,
  scenario metadata, accessible labels, errors, and empty states.
- Use short rules language. Prefer labelled clauses such as OBJECTIVE, ACTION,
  TEST, LIMIT, STATUS, and SCORE when the text explains play.
- Use current player-facing terms: Rush, Hand-off, Tackle Zone, End Zone,
  Block, Blitz, Pickup, Pass, Catch, Turnover, and Parallel Universes.
- Do not use en dashes, em dashes, typographic ellipses, or decorative middle
  dots in player-facing prose. Board notation may retain arrows, crosses,
  dice, and other symbols that convey game state.
- Keep technical comments, tests, and internal documentation technical. They
  are not game copy and do not need the rulebook voice.
- Do not change any game rule, scenario formation, score, or control flow.

## Success Criteria

- Every scenario description starts with OBJECTIVE and states the required play.
- Tutorial briefings use labelled rules clauses and explain all six drills.
- Game status messages identify the current action before giving the instruction.
- Rankings, local history, settings, errors, and editor messages use direct text
  without promotional or conversational filler.
- No player-facing prose contains an en dash, em dash, typographic ellipsis, or
  decorative middle dot.

---

# Pass / Hand-off Confirmation and Illustrated Help

**Status:** Shipped.

## Requirements

- Selecting a legal Pass or Hand-off receiver stages the target instead of
  executing immediately. Reuse movement's pitch-anchored red and green
  decision control with action-specific accessible labels.
- Red returns to receiver selection without abandoning the activation. Green
  commits the Pass or Hand-off. Escape dismisses a staged receiver before it
  cancels the activation.
- Add Help & rules to the shared player menu and return to the screen that
  opened it without resetting an active puzzle.
- Provide separate Getting started, Actions, and Parallel Universes pages.
  Explain one-turn scoring, action confirmation, hierarchical universe
  numbers, branch strips, Reset, confirmed Give up, and lockstep replay.
- Use responsive, accessible code-native diagrams so the explanations remain
  legible on phones and desktops.

## Success Criteria

- Passes and Hand-offs cannot be committed by a single receiver tap.
- The Help screen is reachable everywhere `UserMenu` appears and its Back
  control restores the previous app mode.
- Parallel Universes has labelled illustrations for its tree, branch strips,
  and lockstep behavior, including the look-ahead stop before a newly marked
  square.

---

# Parallel Universe Branch-point Reset

**Status:** Shipped.

## Requirements

- Preserve the exact board snapshot created at the start of every universe.
- Offer Reset branch on any universe with authored play after that snapshot,
  including historical parents that later split again.
- Confirm before resetting and state how many child branches will be removed.
- Restore the chosen universe to its branch point, remove every descendant
  line, select the restored universe, and leave sibling universes untouched.
- Keep the inherited partial-movement Reset move control as a separate,
  lightweight operation.

## Success Criteria

- Resetting a parent after a second block removes all of that parent's children
  and turns the parent back into a playable leaf at its original board state.
- Resetting never rewinds a sibling branch or silently concedes probability.
- No branch data is discarded before the confirmation step.

---

# Completed-play Review Orientation and Objective Guidance

**Status:** Shipped.

## Requirements

- Render completed-play diagrams in the same clockwise landscape orientation
  as the played pitch.
- Keep the branch-review heading visible and give the diagrams and action log a
  dedicated scroll region that remains usable on short phone viewports.
- State on the main screen, Getting started help, and every Tutorial briefing
  that the aim is to find the sequence of moves with the highest probability of
  meeting the puzzle's stated objective.
- Keep that general rule independent of touchdowns so later one-turn puzzles
  can define outcomes such as a successful foul or a crowd surf.

## Success Criteria

- Increasing portrait row coordinates run right-to-left in the completed-play
  landscape diagram, matching the live board.
- A long branch review can scroll through to its action log without moving its
  title off-screen.
- The shared objective sentence appears consistently on home, in Help, and in
  every Tutorial briefing.

---

# Step-by-step Tutorial Coach

**Status:** Shipped on `hb/tutorial-step-coach`.

## Goal and Fixed Decisions

Extend each existing guided Tutorial drill beyond its opening rules briefing.
After the player chooses **Begin Puzzle**, a sequence of contextual dialogs
teaches what to do next, one interaction at a time, using a simplified picture
of the board or control currently being discussed.

The following product decisions are fixed:

- Guidance uses **graduated hints**. The first prompt teaches the concept and
  next goal without revealing the solution. A more directed hint names the
  relevant player or action. The final hint may identify an exact control,
  target square, receiver, or route.
- Every step uses a **code-native mini diagram**, not a raster screenshot. It
  depicts the current game state with simplified tokens, pitch squares,
  highlights, arrows, and control facsimiles, so the picture remains accurate
  across viewport sizes, pitch orientations, themes, and later UI refinements.
- The walkthrough starts fresh on **every guided attempt**. It is attempt-local,
  is not stored as completed, and replays after Restart or after leaving and
  starting the drill again whenever automatic Tutorial guidance is enabled.
- Guided-drill scope remains the source of truth: a scenario receives a
  walkthrough when `tutorialLessonFor(scenario.id)` returns lesson content.
  All six current Tutorial drills now have lesson and guide content. The sixth
  drill retains its unrestricted action set while teaching Blocking, Pickup,
  and Parallel Universes.

## Player Experience Requirements

### Entry and progression

- Starting the Tutorial series opens a chooser containing all six drills.
  Players may select any unfinished drill or replay a completed drill. A replay
  replaces that drill's previous result in place rather than adding a duplicate
  or increasing the completed count. Completing a drill returns to the chooser
  until all six have been completed once, after which their probabilities
  combine into the normal series result. The chooser does not reset probability
  or create an extra turn inside a puzzle.
- Keep the existing opening `TutorialLessonDialog`. **Begin Puzzle** closes the
  rules briefing and immediately opens the first contextual coach step before
  the player can make an uninstructed first interaction.
- Each coach step describes one next goal. Dismissing it with **Try it** returns
  to the unchanged board. When the player reaches that step's semantic
  milestone, the next step opens automatically.
- Progress is driven by authoritative game state and committed action-log
  events, not timers, DOM text, animation completion, or inferred clicks.
  Selection/action-mode milestones may use explicit existing handlers because
  they occur before an action-log entry exists.
- Stage completion must be semantic rather than tied to one coordinate path
  whenever the rules permit alternatives. For example, “enter Pass targeting”
  and “complete a Pass to the intended receiver” are milestones; every square
  traversed on the way is not necessarily one.
- A dismissed current step does not repeatedly reopen while the board is idle.
  It reopens only when the player asks for it, makes a contradictory guided
  interaction, or completes the milestone and advances to the next step.
- Reaching the puzzle objective completes the guide silently. The normal score,
  Parallel Universes, review, and submission flows remain authoritative and
  unchanged.

### Graduated hint behavior

Every stage owns three disclosure tiers, and its text and diagram reveal only
what that tier permits:

1. **Concept:** explain the immediate goal and the rule/UI concept. Highlight a
   general region or type of control, but do not identify an exact solution.
2. **Directed hint:** name the relevant player, action, receiver, or board area
   and explain why it matters. The diagram may spotlight that subject.
3. **Exact hint:** show one verified next interaction, target square, or route
   that advances an intended high-probability solution. If equivalent best
   choices exist, it may show one and say that alternatives are valid.

- Each dialog has **More help** until the final tier. Pressing it advances one
  tier in place and updates both copy and diagram without closing the dialog.
- A reversible interaction that contradicts the current stage's authored
  expectations (wrong player, unavailable/wrong action, or wrong receiver or
  target) reopens the stage at the next tier. Camera controls, Help, menus,
  branch viewing, and other neutral interactions never count as mistakes.
- A committed divergent action is never silently undone. The coach advances
  its hint tier and explains the available recovery using existing controls.
  If the authored guided sequence is no longer reachable, the recovery prompt
  may point to **Reset move**, **Reset branch**, or **Restart Puzzle**, but the
  guide itself must not invoke them or change probability, activation, branch,
  or action-log state.
- A mistake can increase the tier by only one level per distinct interaction;
  React rerenders or repeated observation of the same state cannot escalate it.
- The final tier is an aid, not an input lock. The player may still dismiss it
  and use any legal alternative.

### Controls, replay, and preferences

- Coach dialogs provide **Try it**, **More help** when available, and **Skip
  guide**. Skipping suppresses all remaining automatic coach steps for the
  current attempt only; it does not alter the global preference or hide the
  opening briefing on a later attempt.
- Escape behaves like **Try it**: close the current step without skipping the
  attempt or changing the global preference.
- The existing `showTutorialGuidance` preference controls both the opening
  briefing and automatic coach steps. Do not add per-stage or seen-step local
  storage. If guidance is disabled from the opening dialog or Settings, no
  automatic step sequence starts.
- Rename player-facing **Rules briefings** language to **Tutorial guidance**
  where necessary so the setting accurately describes both parts of the
  experience. Preserve the existing identity-keyed preference value and
  backward-compatible reads.
- Game Tools exposes **Tutorial guide** during a guided scenario. It opens the
  current stage manually even when the attempt was skipped or automatic
  guidance is disabled. Before a step sequence starts, it may reopen the
  opening briefing; after guide completion, it opens a compact stage index or
  the last relevant stage rather than restarting the game.
- Restart creates a new attempt-local guide controller and replays the opening
  briefing and steps when guidance is enabled. Branch Reset and Reset move are
  not new attempts and must not duplicate already-completed early stages.

## Mini-diagram Requirements

- Render diagrams from the current `GameState` or selected universe plus an
  authored focus descriptor. Do not capture the DOM, use canvas screenshots,
  or store screenshots of a particular device/theme.
- A pitch diagram may crop to the relevant squares but must retain enough
  landmarks and coordinate labels for the player to locate the same area on
  the live board. Use stable piece ids and positions; resolve player names from
  the current scenario/state rather than duplicating them in visual assets.
- Diagram primitives must cover: active/opposing tokens, ball carrier or loose
  ball, movement route/target, Tackle Zone or risk area, Pass/Hand-off line,
  Block target and dice, red/green confirmation control, and Parallel Universe
  strip/lockstep where required by a guided lesson.
- The diagram disclosure follows the hint tier. A concept image cannot leak an
  exact route that its text intentionally withholds.
- Every figure has concise descriptive alternative text that conveys the
  instructional relationship, not a list of decorative details. Information
  shown only by color also uses shape, label, line style, or iconography.
- Diagrams scale inside a 320 px-wide modal without horizontal page overflow,
  remain legible at 200% zoom, and never push dialog actions out of reach;
  the dialog body scrolls internally on short viewports.

## Required Guided Sequences

Exact copy and coordinates are authored during implementation and verified
against the scenario fixtures and probability engine. The initial tier must not
prescribe the route; the final tier may reveal one verified intended move.

| Scenario | Required stage sequence and diagram subjects |
| --- | --- |
| `scenario-001` Movement | Find the carrier and objective; open Move; read reachable squares and preview a route; use red/green route confirmation; reach the End Zone. Show carrier/goal landmarks, movement range, route preview, and confirmation controls. |
| `scenario-004` Tackle Zones and Dodging | Identify marked/risky squares; select Sera and Move; compare route roll markers and cumulative chance; confirm a chosen route; score. Show opponents' adjacent influence, Dodge markers, Sera's Dodge skill/reroll cue, and safer versus riskier route shapes without revealing the exact route at tier one. |
| `scenario-002` Hand-off | Identify carrier and receiver; choose Hand-off; move into Hand-off position; select and confirm the receiver; activate the receiver and score. Show the two named tokens, adjacency, Hand-off/Catch line, confirmation controls, and the receiver still available to activate. |
| `scenario-003` Pass | Identify thrower and receiver; choose Pass; move clear of Tackle Zones; select the receiver and inspect Pass/Catch chances; confirm; activate the receiver and score. Show marking, the thrower's safe throwing area, range line, receiver, confirmation controls, and post-Catch activation availability. |
| `scenario-005` The Drive | Read the whole objective and plan activation order; begin the carrier's escape/Hand-off sequence; complete the transfer; navigate the receiver's remaining route; score. Show the two-player order, cumulative-risk readout, transfer point, and the next relevant board region. Avoid turning the concept tier into a complete solution diagram. |
| `scenario-006` Blocking, Pickups and Parallel Universes | Select Cedric and Block Muzgash away from the loose ball; work through the resulting live universes; recover the ball; complete every live branch. Show the relevant formation, Block controls, result branches, Pickup target, and universe strip without prescribing a complete scoring sequence at the concept tier. |

For every scenario, author stable stage ids and at least one recovery message.
Exact-tier routes must be checked against current rules math and scenario data;
tests must fail if a scenario edit removes a referenced player/square or makes
the authored next interaction illegal.

## Accessibility and Interaction Requirements

- Reuse the focus-trapped modal shell and `useModalFocus`: `role="dialog"`,
  accessible title, initial focus, trapped Tab order, Escape handling, and
  restoration to the pitch or control that preceded the dialog.
- Announce drill and stage progress, for example **Movement: Step 2 of 5**,
  independently from hint tier. Hint escalation is also announced to screen
  readers without reading the entire dialog twice.
- No instruction may depend on hover. Touch, mouse, and keyboard users receive
  the same stage and can operate every coach action.
- Automatic dialogs occur only at meaningful boundaries, never while a target
  confirmation, dice decision, push choice, or another modal is already open.
  Queue the coach step until the higher-priority interaction closes.
- Only one modal may own focus at a time. Existing confirmation, block split,
  push/follow-up, completion, report, and leave-series dialogs take priority.

## Constraints and Non-goals

- A puzzle remains exactly one turn. Do not add End Turn, turns/halves, a match
  score, banked activations, or any way to reset the probability chain.
- The guide teaches existing gameplay; it must not change movement, Dodge,
  Pass, Hand-off, Block, Parallel Universes, completion, or probability rules.
- Guidance cannot perform moves, restrict otherwise legal controls, select a
  die result, resolve a universe, or guarantee that the player follows the
  hinted solution.
- Do not add tutorial fields to scenario JSON or shared validation. Guidance
  remains client-owned product content and must not create browser/server/
  Netlify schema drift.
- Do not import a package from `shared/`; this feature requires no shared or
  server dependency.
- Do not add raster screenshot generation or image-generation assets for these
  steps. Existing decorative Tutorial artwork may remain in the opening
  briefing, but the new contextual pictures are code-native.
- Do not persist guide position, hint tier, mistakes, or completion. Refreshing
  or restarting begins a new guided attempt; leaderboard and analytics payloads
  must not contain board state, exact routes, or free-form guide content.
- Unknown scenarios or lesson definitions without a guide continue to play
  normally with their opening briefing only. Guidance failure must never make
  a puzzle unplayable.

## Architecture

| Area | Responsibility |
| --- | --- |
| `client/src/tutorialGuides.ts` | React-free, typed guide definitions keyed by existing lesson/scenario id: stable stage ids, three hint tiers, focus descriptors, semantic milestones, expected interactions, and recovery copy. Validate all referenced piece ids and coordinates against loaded scenarios. |
| `client/src/tutorialGuideProgress.ts` | Pure state machine/reducer that advances stages from previous/current game snapshots and normalized interaction events, deduplicates mistakes, escalates hint tiers, queues prompts behind other dialogs, and resets only for a new attempt. |
| `client/src/useTutorialGuide.ts` | Thin React integration owning attempt-local visibility, skipped state, current stage/tier, manual reopen, and callbacks into the pure reducer. No gameplay mutations. |
| `client/src/TutorialGuideDialog.tsx` and scoped CSS | Accessible coach modal with progress, hint-tier copy, mini diagram, More help, Try it, and Skip guide controls. |
| `client/src/TutorialMiniDiagram.tsx` and scoped CSS | Render a responsive SVG/code-native board or control diagram from current state plus the stage focus descriptor, with tier-aware detail and alternative text. Reuse presentation helpers where safe without mounting the full interactive `Pitch`. |
| `client/src/TutorialPuzzleChooser.tsx` and scoped CSS | Present canonical drill order, completed/remaining progress, unfinished selection, and completed-drill replay at series start and between drills. |
| `client/src/tutorialLessons.ts` | Retain opening rules briefings and action gating. Associate only existing guided lessons with the separate guide definitions; do not duplicate scenario names/descriptions. |
| `client/src/App.tsx` | Start/reset the guide with puzzle attempts, feed normalized selection/action/commit/universe milestones, enforce modal priority, connect Begin Puzzle and Game Tools, and leave all game handlers authoritative. Avoid embedding guide content or stage-specific conditionals here. |
| `client/src/GameToolsMenu.tsx`, `SettingsScreen.tsx` | Expose Tutorial guide reopening and rename the existing preference label to Tutorial guidance without changing its stored meaning. |
| Analytics allowlist | Record aggregate guide shown/dismissed, stage reached, hint requested, contradiction, skipped, and completed events using scenario/stage ids only. Never send positions, routes, player identity, or copy. Analytics failure remains non-blocking. |
| Focused tests and `client/e2e/` | Verify content references, pure progression/escalation, modal accessibility, preference/replay behavior, gameplay non-mutation, modal priority, and real mobile layout/interaction. |

## Implementation Steps

1. Add typed guide/focus/milestone/interaction definitions and author the six
   required guided sequences. Add validation tests proving stable ids are
   unique, every stage has three tiers and alt text, referenced players/squares
   exist, and exact-tier interactions are legal in their fixture state.
2. Implement the pure attempt-local progression reducer. Cover semantic stage
   advancement, neutral interactions, one-level contradiction escalation,
   deduplication across rerenders, skip/manual-reopen behavior, monotonic
   progress across Reset move/branch, and full reset on a new attempt.
3. Build `TutorialMiniDiagram` with reusable SVG primitives for pitch crops,
   tokens, ball, routes, risk regions, action/confirmation controls, and
   universe strips. Test tier-aware disclosure, orientation-independent
   coordinates, accessible descriptions, and missing-focus fallbacks.
4. Build the focus-trapped `TutorialGuideDialog`. Connect More help, Try it,
   Escape, Skip guide, screen-reader announcements, internal scrolling, and
   focus restoration; add component tests for all controls and tiers.
5. Wire Begin Puzzle, restart/new-attempt initialization, semantic gameplay
   events, objective completion, Game Tools reopening, and modal-priority
   queuing through `useTutorialGuide`. Keep stage-specific content and matching
   out of `App.tsx`, and verify the hook never calls a gameplay mutation.
6. Rename player-facing Rules briefings controls to Tutorial guidance while
   retaining `showTutorialGuidance` compatibility. Add aggregate allowlisted
   analytics events and tests that payloads contain no board or route data.
7. Add integration tests for one complete attempt through each guided scenario,
   including an alternate valid route, manual hint escalation, contradictory
   input/recovery, Skip guide, guidance disabled, restart replay, and completion
   without guide interference.
8. Add real-browser coverage at 320 px, representative phone/tablet/desktop
   sizes, touch and keyboard input, 200% zoom, and a queued prompt behind an
   existing confirmation/block modal. Confirm no page-level overflow and that
   the live pitch remains unchanged when dialogs open/close.
9. Update `docs/agent-context/frontend-flow.md` with shipped replay/preference/
   modal behavior and `scenarios-and-series.md` with guide-content ownership.
   Run `npm run verify` and the relevant mobile Playwright matrix before marking
   this section Shipped.

## Success Criteria

- In every Tutorial drill, Begin Puzzle leads into a complete
  sequence of contextual steps, and each next dialog appears only after its
  preceding semantic milestone or a contradictory guided interaction.
- Every step includes a legible mini diagram of the relevant current board or
  control. No new step relies on a static screenshot or leaks exact-route detail
  before the matching hint tier.
- The first prompt preserves puzzle-solving agency; More help or mistakes
  progress through directed and exact help one tier at a time.
- Players can use an alternate legal solution, skip the remaining guide, or
  disable automatic Tutorial guidance without losing access to normal play.
- Restarting replays the guide on every guided attempt; Reset move/branch does
  not duplicate early stages; Game Tools can reopen the current guidance at any
  time without changing the board.
- Opening, escalating, dismissing, skipping, or completing guidance does not
  change pieces, activations, action logs, universes, probability, score, or
  leaderboard submissions.
- A new series and every non-final completion show the chooser; any unfinished
  or completed drill can be selected, replay replaces the earlier result, and
  completing all six still produces exactly one combined series result.
- Dialogs are keyboard/touch accessible, never compete with another modal, and
  keep diagrams, text, and actions reachable at 320 px and 200% zoom.
- Content/reference validation, unit/integration tests, `npm run verify`, and
  the relevant real-browser mobile tests pass.
