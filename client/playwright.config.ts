import { defineConfig, devices } from '@playwright/test';

/**
 * Mobile layout harness.
 *
 * jsdom (the vitest environment) has no layout engine — every box measures
 * 0×0 there, so none of the sizing regressions this suite guards can be
 * caught by the unit tests. These specs run against a real browser and assert
 * on measured geometry.
 *
 * The device list is the matrix the mobile work was sized against: the
 * narrowest realistic phone, the common modal sizes, and the 768px breakpoint
 * boundary. Landscape variants exist because a phone held sideways used to
 * fall through to the desktop layout and clip 40% of the pitch.
 */
export default defineConfig({
  testDir: './e2e',
  // Geometry assertions are deterministic; a retry would only mask flake in
  // the harness itself.
  retries: 0,
  fullyParallel: true,
  // Nine projects share one Vite dev server. Left uncapped, the workers
  // contend on it hard enough that startGame() exceeds the default 30s and
  // reports failures that pass immediately when run serially — false alarms
  // from a harness whose whole job is to be believed. Capped workers plus a
  // longer ceiling costs about a minute on a full run and removes them.
  workers: process.env.CI ? 2 : 4,
  timeout: 60_000,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    // ── Portrait phones ──────────────────────────────────────────────────
    {
      name: 'galaxy-s8',        // 360×740 — narrowest realistic phone
      use: { ...devices['Galaxy S8'] },
    },
    {
      name: 'iphone-se',        // 375×667 — shortest common viewport
      use: { ...devices['iPhone SE'] },
    },
    {
      name: 'iphone-14',        // 390×844 — modal iOS size
      use: { ...devices['iPhone 14'] },
    },
    {
      name: 'pixel-7',          // 412×915 — modal Android size
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'iphone-14-pro-max', // 430×932
      use: { ...devices['iPhone 14 Pro Max'] },
    },

    // ── Landscape phones ─────────────────────────────────────────────────
    // These are the regression guard for the clipping bug: at 812×375 the
    // viewport is wider than the old 768px breakpoint, so the desktop layout
    // applied and six of fifteen pitch rows rendered outside a wrapper with
    // overflow: hidden.
    {
      name: 'iphone-14-landscape',
      use: { ...devices['iPhone 14 landscape'] },
    },
    {
      name: 'pixel-7-landscape',
      use: { ...devices['Pixel 7 landscape'] },
    },

    // ── Tablet / breakpoint boundary ─────────────────────────────────────
    {
      name: 'ipad-mini',        // 768×1024 — exactly on the old breakpoint
      use: { ...devices['iPad Mini'] },
    },

    // ── Desktop control ──────────────────────────────────────────────────
    // Proves the mobile work didn't regress the pointer-fine layout.
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
