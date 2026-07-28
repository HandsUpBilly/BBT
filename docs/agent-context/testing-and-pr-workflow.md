# Testing And PR Workflow

Primary files:

- `client/package.json`
- `client/vitest.config.ts`
- `client/src/useGameState.test.ts`
- `AGENTS.md`

## Standard Checks

Run before committing code changes:

```bash
npm run build
cd client && npm run lint
cd client && npm test -- --run
```

For docs-only changes, build/lint/test are not usually necessary, but at least
check `git diff --stat` and file paths.

## Package Layout

Dependencies are installed separately:

```bash
cd client && npm install
cd server && npm install
cd netlify/functions && npm install
```

No workspace tooling is configured.

## Common Conflicts

`App.tsx` is the common conflict point because many features touch:

- imports,
- identity/user menu,
- app mode render branches,
- series submit flow,
- editor preview flow.

After resolving `App.tsx`, run build and lint.

## Git Notes

- The terminal may not have `$EDITOR`; use `GIT_EDITOR=true git rebase --continue`.
- After rebasing a PR branch, push with `git push --force-with-lease`.
- Preserve unrelated local changes with `git stash push -- <path>` before merges.
- Do not include local editor-generated scenario drafts in unrelated conflict
  resolution commits.

## PR Documentation Rule

If a PR changes durable behavior documented under `docs/agent-context/`, update
the matching doc in the same PR.

