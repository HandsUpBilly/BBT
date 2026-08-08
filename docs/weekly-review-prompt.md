# Weekly Code and Documentation Review — Prompt

Paste the prompt below into a fresh Claude Code session in the BBT repo.

It is written to catch the specific failure modes this project has actually
hit, not generic "review my code" output. Each check below traces to a real
defect: silently-drifting duplicated logic, unreachable code nobody noticed,
docs that contradicted the shipped behavior, a validation gap that reached
production, and a build break that passed every local check.

---

## The prompt

> Perform the weekly code and documentation review for this project.
>
> Start by reading `AGENTS.md` and `docs/agent-context/README.md`, then only the
> context docs relevant to what changed. Scope the week's work with:
>
> ```bash
> git fetch origin && git log --oneline --since="7 days ago" origin/main
> git diff --stat "$(git rev-list -1 --before='7 days ago' origin/main)"..origin/main
> ```
>
> If nothing merged this week, say so and check only the standing invariants
> (sections 2, 3, and 6 below).
>
> Report findings ordered by severity, each with a `file:line` reference and a
> concrete failure scenario — what input or sequence produces the wrong result.
> Do not list stylistic preferences. If you find nothing in a section, say so
> explicitly rather than padding.
>
> **1. Verify the build actually works.**
> Run `npm run verify`. It must be green: lint, both test suites, the client
> build, and `check:functions`.
> If `check:functions` is failing, that is the top finding — it means the
> Netlify deploy is broken even though lint and tests pass.
> Also confirm the live site is serving current code: `curl -s -o /dev/null -w "%{http_code}" https://bb-trainer.netlify.app/api/progress`
> should return 200. GitHub reports no check-runs for `main` (Netlify only posts
> those for PR previews), so an empty status list is not evidence of success —
> probe the site.
>
> **2. Has `shared/` drifted or grown a dependency?**
> `shared/` exists because scenario validation, Google auth, and report
> formatting were previously three hand-synced copies that had already diverged.
> - Does any file in `shared/` import a package? It must not — resolution walks
>   up from the importing file, and `shared/` is not an ancestor of any target's
>   `node_modules`. Dependencies are injected from the target
>   (see `makeGoogleTokenVerifier`).
> - Has any consumer reimplemented logic locally instead of importing it? Check
>   the client editor, `server/`, and `netlify/functions/` for validation, auth,
>   or report-formatting code that duplicates `shared/`.
> - Do the `.d.ts` files still match their `.js` counterparts?
>
> **3. Is anything unreachable?**
> A whole multi-turn subsystem (`handleEndTurn`, `PhaseModal`, `freeplay`) once
> sat exported-but-never-called, with a test covering a path no user could reach.
> Look for exported functions with no non-test callers, `AppMode`/state variants
> never assigned, CSS classes matching no element, and tests exercising code the
> UI cannot invoke.
>
> **4. Do the docs still match the code?**
> This is the section that decays fastest — treat it as first-class, not a
> footnote.
> - For each file under `docs/agent-context/`, verify its concrete claims against
>   the source. Flag anything stated as current that is no longer true.
> - `AGENTS.md`: is the env-var table complete? Do the documented commands exist
>   and work?
> - `spec.md`: every top-level section carries a `**Status:**` line. Did anything
>   ship this week whose Status still says Planned or Partial? Are there internal
>   contradictions between sections?
> - Did any PR this week change durable behavior without updating its matching
>   context doc?
>
> **5. Score and report integrity.**
> The client computes the probability that becomes the leaderboard score, so
> anything that lets a player rewind state while keeping its effects is a scoring
> exploit, not a UI bug.
> - Does every path that mutates `pieces` or `ballPosition` mid-activation get
>   correctly rewound by `clearSelection(state, true)` via `activationSnapshot`?
> - Can any new action reach the board before its probability is logged?
> - Does `shared/scoreValidation.js` still bound every field that feeds the sort?
> - Are the documented limits still honestly stated? A forged clean run
>   (`probability: 1, diceCount: 0, moves: []`) is knowingly accepted — flag any
>   comment or doc that overclaims what the validation prevents.
>
> **6. Security posture.**
> - Do all `/api/editor/*` routes still require an allowlisted admin, including
>   the GET that returns unpublished drafts?
> - Does the empty-`ADMIN_EMAILS` default still match what `AGENTS.md`
>   documents, and does `EDITOR_ALLOW_UNAUTHENTICATED=false` still produce a
>   503?
> - Is `GITHUB_ISSUES_TOKEN` still server-only, never a `VITE_` variable?
> - Do any new endpoints need rate limiting?
> - Does the CSP in `netlify.toml` still cover everything the app loads, and
>   nothing more?
>
> **7. Rules fidelity.**
> Compare the engine against `docs/bb2025-ffb-rules-notes.md`. Known deliberate
> simplifications — flat assist counting, no armour/injury rolls, no chain
> pushes, failed rolls not simulated — are documented and out of scope. Flag only
> *new* divergences, or simplifications that have become wrong because
> surrounding behavior changed.
>
> **8. Test coverage of the week's changes.**
> Did new behavior arrive with tests? Would each new test actually fail if its
> fix were reverted? Prefer identifying one untested high-risk path over listing
> many trivial gaps.
>
> **Finally:** propose the three highest-value fixes, in priority order, with a
> rough size estimate for each. Ask before implementing anything.
>
> Verify claims against the code rather than assuming. If a check is
> inconclusive, say so — do not report something as passing because you did not
> find evidence against it.

---

## Notes on using this

**Run it against `main`, with a clean tree.** The review assumes `npm run verify`
reflects reality; uncommitted work makes findings ambiguous.

**Section 4 is the one to protect.** Code review is habit-forming; doc review is
not. `netlify-deploy.md` once claimed production editor saves didn't exist —
long after they shipped — and `AGENTS.md` promised scenario JSON needed no import
registration, which was false for the Netlify seed and silently dropped new
puzzles from production.

**"Green locally" is not "green deployed."** Lint, `tsc`, and 143 tests all
passed on a tree that could not deploy. Section 1 exists for that reason.

**Adjust the window** if you review on a different cadence — the `--since` values
assume weekly. They use dates rather than `main@{7.days.ago}`, which reads the
*local reflog* and silently gives wrong results on a fresh clone or a machine
that hasn't fetched in a while.
