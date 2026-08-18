---
name: run-bbt
description: Build, run, and drive the BBT (Turn 16) Blood Bowl puzzle web app — the Express API plus the Vite/React client. Use when asked to start BBT, run its dev server, take a screenshot of the app, or interact with the running UI (login, puzzle select, gameplay).
---

BBT is a two-process web app: an Express API (`server/`, port 3001) behind a
Vite dev server (`client/`, port 5173) that proxies `/api/*` to it. For
agent/automated use, start both, then drive the browser via the Playwright
REPL at `.claude/skills/run-bbt/driver.mjs`. There is no `chromium-cli` in
this environment, and the Chromium revision `@playwright/test` expects isn't
the one pre-installed — the driver pins the executable path itself, see
Gotchas.

All paths below are relative to the repo root.

## Prerequisites

Nothing beyond Node (checked here: v22) and the pre-installed
`/opt/pw-browsers/chromium-<rev>` Chromium. No `apt-get` packages or
`playwright install` needed — do **not** run `playwright install`, it will
try to fetch a browser revision that's blocked/unnecessary in this
environment.

## Setup

```bash
cd client && npm install --no-audit --no-fund
cd ../server && npm install --no-audit --no-fund
```

## Build

No separate build step is needed to run in dev mode (Vite serves the client
directly). `npm run build` (repo root) exists for a production bundle but
isn't part of the run loop.

## Run (agent path)

Start both processes in the background and poll until each answers, then
drive with the REPL:

```bash
# from repo root
npm start &            # Express API on :3001 ("start" = cd server && node index.js)
npm run dev &           # Vite dev server on :5173 ("dev" = cd client && npm run dev)
timeout 30 bash -c 'until curl -sf http://localhost:3001/api/scenarios >/dev/null; do sleep 1; done'
timeout 30 bash -c 'until curl -sf http://localhost:5173/ >/dev/null; do sleep 1; done'

node .claude/skills/run-bbt/driver.mjs
```

Stop by killing the port listeners (`npm start`/`npm run dev` don't forward
signals to the child they spawn, so `kill %1 %2` alone won't free the
ports):

```bash
lsof -ti:3001 -sTCP:LISTEN | xargs -r kill
lsof -ti:5173 -sTCP:LISTEN | xargs -r kill
```

Wrap the driver in tmux for interactive, one-command-at-a-time use:

```bash
tmux new-session -d -s bbt -x 200 -y 50
tmux send-keys -t bbt 'cd /home/user/BBT && node .claude/skills/run-bbt/driver.mjs' Enter
timeout 15 bash -c 'until tmux capture-pane -t bbt -p | grep -q "driver>"; do sleep 0.2; done'
tmux send-keys -t bbt 'launch' Enter
timeout 15 bash -c 'until tmux capture-pane -t bbt -p | grep -q "launched"; do sleep 0.2; done'
tmux send-keys -t bbt 'nav' Enter
tmux send-keys -t bbt 'ss 01-landing' Enter
tmux capture-pane -t bbt -p
```

Screenshots land in `/tmp/shots/` (override with `SCREENSHOT_DIR`). Dev
server URL defaults to `http://localhost:5173` (override with `BBT_URL`).

### Commands

| command | what it does |
|---|---|
| `launch` | launch headless Chromium (pinned executable, see Gotchas) |
| `nav [url]` | navigate; defaults to `$BBT_URL` |
| `ss [name]` | screenshot → `/tmp/shots/<name>.png` |
| `click <css-sel>` | click first match |
| `click-text <text>` | click a button/link/`[role=button]` by visible text — exact match preferred, falls back to substring |
| `fill <css-sel> <text>` | fill an input (goes through Playwright's real input pipeline, needed for React controlled inputs) |
| `type <text>` / `press <key>` | keyboard input |
| `wait <css-sel>` | wait up to 10s for a selector |
| `eval <js-expr>` | evaluate in the page, print JSON |
| `text [css-sel]` | print innerText (first 800 chars), body if no selector given |
| `quit` | close browser, exit |

Page console errors and uncaught exceptions print automatically as
`[console.error]` / `[pageerror]` lines — check for these before declaring a
flow successful.

### Verified example flow: guest login → home screen

```
launch
nav
ss 01-landing
click-text Play As Guest
fill input[type="text"] RunSkillTester
click-text Continue
ss 02-home
```

`02-home` should show the "TURN 16" masthead, the guest name in the header
menu, and the featured playbook card ("Humans vs Orcs: The Nuffle Shuffle")
with Series / Single Plays / Puzzle Creator tabs.

## Run (human path)

```bash
npm start &      # server, :3001
npm run dev       # client, :5173 — opens in foreground; Ctrl-C to stop
```

Then open `http://localhost:5173` in a real browser. `GOOGLE_CLIENT_ID` /
`VITE_GOOGLE_CLIENT_ID` are unset in this environment, so the header shows
"Google Login Unavailable" and only the guest flow works — this is expected,
not a bug (see `AGENTS.md` Environment Variables table).

## Test

```bash
npm run verify   # lint + node/vitest suites + build + check:functions
```

`client/e2e/` (Playwright, `npm --prefix client run test:e2e`) is separate
from this driver — it's the project's real layout-regression suite, not an
agent-driving tool, and needs `npx playwright install` (which conflicts with
the Gotcha below about not installing browsers in this environment). Don't
run it as part of this skill's flow.

## Gotchas

- **`chromium.launch()` with no `executablePath` fails.** The
  `@playwright/test` version pinned in `client/package.json` (1.62.1) looks
  for a Chromium revision under `/opt/pw-browsers/chromium_headless_shell-<rev>`
  that doesn't exist here — only `chromium-<rev>/chrome-linux/chrome` is
  installed. The error suggests running `npx playwright install`; don't —
  the driver resolves the installed revision directory itself
  (`resolveChromiumExecutable()` in `driver.mjs`, override with
  `BBT_CHROMIUM_PATH` if the installed revision ever changes).
- **`@playwright/test` isn't resolvable via a plain ESM `import` from inside
  `.claude/skills/run-bbt/`.** It only exists in `client/node_modules`, and
  Node's ESM resolution walks up from the *importing file's own path*, not
  `cwd` — so running the driver from `client/` doesn't help either. The
  driver uses `createRequire(path.join(CLIENT_DIR, 'package.json'))` to
  resolve it explicitly instead of a static `import`.
- **Text-matching button clicks need an exact-match pass first.** A loose
  substring/regex match on button text (e.g. `/play|continue/i`) matches
  "**Play** As Guest" before it reaches "Continue", so a script meaning to
  click "Continue" silently re-clicks "Play As Guest" instead — the page
  looks unchanged and it's easy to misread as a hang. `click-text` tries an
  exact `textContent` match before falling back to substring, for exactly
  this reason.
- **`npm start` / `npm run dev` backgrounded with `&` don't die on `kill
  %1`** — npm doesn't forward signals to the `node`/`vite` child it spawns.
  Kill the port listener instead (`lsof -ti:<port> -sTCP:LISTEN | xargs -r
  kill`) or the next run hits `EADDRINUSE`.
- **The one console error on every page load is expected**:
  `net::ERR_TUNNEL_CONNECTION_FAILED` from Google's Identity Services script,
  because `VITE_GOOGLE_CLIENT_ID` isn't set in this environment. Don't treat
  it as a driver bug; a real regression will add *other* errors alongside it.

## Troubleshooting

- **`Cannot find package '@playwright/test'`**: you ran the driver with a
  plain `node driver.mjs` from a shell in a directory where Node's
  resolution walk-up doesn't hit `client/node_modules` — this shouldn't
  happen with the shipped driver (it resolves explicitly), but if you copy
  the launch logic elsewhere, keep the `createRequire` trick.
- **`browserType.launch: Executable doesn't exist at
  .../chrome-headless-shell...`**: default Playwright browser resolution,
  see Gotchas above — use the driver as shipped, don't call
  `chromium.launch()` with no args.
- **`curl: (7) Failed to connect` on the readiness poll**: one of the two
  `npm` processes didn't start — check for a stale listener on the port
  (`lsof -i:3001` / `lsof -i:5173`) left over from a previous run and kill it
  first.
