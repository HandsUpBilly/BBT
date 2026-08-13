// REPL driver for the BBT (Turn 16) web app.
// Run against an already-running dev server (see SKILL.md "Run (agent path)").
// Designed for agents: wrap in tmux, send-keys commands, capture-pane output.
import * as readline from 'node:readline';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';

// @playwright/test lives in client/node_modules, not anywhere ESM's
// import-resolution walk-up from this file (.claude/skills/run-bbt/) reaches.
// Resolve it explicitly against client/package.json instead of relying on cwd.
const CLIENT_DIR = path.resolve(import.meta.dirname, '../../../client');
const { chromium } = createRequire(path.join(CLIENT_DIR, 'package.json'))('@playwright/test');

const SHOT_DIR = process.env.SCREENSHOT_DIR || '/tmp/shots';
fs.mkdirSync(SHOT_DIR, { recursive: true });

const BASE_URL = process.env.BBT_URL || 'http://localhost:5173';

// The @playwright/test version pinned in client/package.json (1.62.1) expects a
// browser revision the pre-installed /opt/pw-browsers doesn't have — launch()
// with no executablePath fails with "Executable doesn't exist at
// .../chromium_headless_shell-XXXX/...". Pin to whatever revision dir actually
// exists instead of trusting Playwright's own version resolution.
function resolveChromiumExecutable() {
  if (process.env.BBT_CHROMIUM_PATH) return process.env.BBT_CHROMIUM_PATH;
  const root = '/opt/pw-browsers';
  const rev = fs.readdirSync(root).find(d => /^chromium-\d+$/.test(d));
  if (!rev) throw new Error(`no chromium-<rev> dir found under ${root}`);
  return path.join(root, rev, 'chrome-linux', 'chrome');
}

let browser = null;
let page = null;

const COMMANDS = {
  async launch() {
    if (browser) return console.log('already launched');
    browser = await chromium.launch({ executablePath: resolveChromiumExecutable() });
    page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('pageerror', e => console.log('[pageerror]', String(e)));
    page.on('console', msg => { if (msg.type() === 'error') console.log('[console.error]', msg.text()); });
    console.log('launched.');
  },

  async nav(url) {
    if (!page) return console.log('ERROR: launch first');
    const target = url || BASE_URL;
    await page.goto(target, { waitUntil: 'networkidle', timeout: 30_000 });
    console.log('nav →', target, '| title:', await page.title());
  },

  async ss(name) {
    if (!page) return console.log('ERROR: launch first');
    const f = path.join(SHOT_DIR, (name || `ss-${Date.now()}`) + '.png');
    await page.screenshot({ path: f });
    console.log('screenshot:', f);
  },

  // Exact text match first (falls back to substring) so labels that are a
  // substring of another visible label ("Continue" vs "Play As Guest" both
  // matching a loose /play|continue/ regex) don't collide.
  async 'click-text'(text) {
    if (!page) return console.log('ERROR: launch first');
    const r = await page.evaluate(t => {
      const els = [...document.querySelectorAll('button, a, [role="button"]')];
      const norm = s => s?.trim();
      const el = els.find(e => norm(e.textContent) === t)
              ?? els.find(e => norm(e.textContent)?.includes(t));
      if (!el) return 'NOT_FOUND';
      el.click(); return 'OK: ' + el.tagName;
    }, text);
    console.log('click-text', JSON.stringify(text), '→', r);
  },

  async click(sel) {
    if (!page) return console.log('ERROR: launch first');
    try { await page.locator(sel).first().click({ timeout: 5000 }); console.log('click', sel, '→ OK'); }
    catch (e) { console.log('click', sel, '→ ERROR:', e.message); }
  },

  // React controlled inputs need Playwright's fill (dispatches real input
  // events); setting el.value via eval() does not fire onChange.
  async fill(args) {
    if (!page) return console.log('ERROR: launch first');
    const [sel, ...rest] = args.split(' ');
    const value = rest.join(' ');
    try { await page.locator(sel).first().fill(value, { timeout: 5000 }); console.log('fill', sel, '→ OK'); }
    catch (e) { console.log('fill', sel, '→ ERROR:', e.message); }
  },

  async type(text) { if (page) await page.keyboard.type(text, { delay: 20 }); },
  async press(key) { if (page) await page.keyboard.press(key); },

  async wait(sel) {
    if (!page) return console.log('ERROR: launch first');
    try { await page.waitForSelector(sel, { timeout: 10_000 }); console.log('found:', sel); }
    catch { console.log('TIMEOUT:', sel); }
  },

  async eval(expr) {
    if (!page) return console.log('ERROR: launch first');
    try { console.log(JSON.stringify(await page.evaluate(expr))); }
    catch (e) { console.log('ERROR:', e.message); }
  },

  async text(sel) {
    if (!page) return console.log('ERROR: launch first');
    console.log(await page.evaluate(
      s => (s ? document.querySelector(s) : document.body)?.innerText?.slice(0, 800) ?? '(null)',
      sel || null));
  },

  async quit() { if (browser) await browser.close().catch(() => {}); browser = null; page = null; },
  help() { console.log('commands:', Object.keys(COMMANDS).join(', ')); },
};

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'driver> ' });

rl.on('line', async line => {
  const [cmd, ...rest] = line.trim().split(/\s+/);
  if (!cmd) return rl.prompt();
  const fn = COMMANDS[cmd];
  if (!fn) { console.log('unknown:', cmd, '— try: help'); return rl.prompt(); }
  try { await fn(rest.join(' ')); } catch (e) { console.log('ERROR:', e.message); }
  if (cmd === 'quit') { rl.close(); process.exit(0); }
  rl.prompt();
});
rl.on('close', async () => { await COMMANDS.quit(); process.exit(0); });

console.log('BBT driver — "help" for commands, "launch" to start, then "nav" (defaults to', BASE_URL + ')');
rl.prompt();
