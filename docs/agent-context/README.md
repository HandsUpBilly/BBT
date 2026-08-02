# Agent Context Docs

Use these docs to avoid rediscovering the same code paths on every task. Read
`AGENTS.md` first, then open only the smallest context doc that matches the
task.

| Task area | Read |
| --- | --- |
| Home screen, app modes, navigation, identity gate, a11y | `frontend-flow.md` |
| Movement, dodges, pass, handoff, blocks, dice logging | `game-rules-engine.md` |
| Scenario JSON, published puzzles, series order | `scenarios-and-series.md` |
| Google login, guest identity, leaderboards, score integrity | `leaderboard-and-auth.md` |
| Admin Mode, puzzle editor, local save API | `puzzle-editor.md` |
| Netlify build, redirects, production functions, headers | `netlify-deploy.md` |
| Verification commands, tests, PR conflicts | `testing-and-pr-workflow.md` |

Two things worth knowing before reading anything else:

- **A puzzle is always exactly one turn.** No End Turn, no turn counter, no
  halves, no running score. See `game-rules-engine.md`.
- **`shared/` is the anti-drift layer.** Validation, auth, and report formatting
  live there and are imported by the client, the Express server, and the Netlify
  functions. Never fork them into a package-local copy.

Keep these docs factual and current. Put plans in `spec.md`, where every section
carries a **Status** line — check it before treating a section as outstanding
work. Once a feature ships, move the durable facts into the matching context doc
and update its Status.

