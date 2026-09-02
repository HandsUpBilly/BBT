import { defineConfig } from '@playwright/test';
import { focusedProjects } from './playwright.projects';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const devPort = new URL(baseURL).port || '5173';

/**
 * Focused local Playwright harness.
 *
 * jsdom (the vitest environment) has no layout engine — every box measures
 * 0×0 there, so none of the sizing regressions this suite guards can be
 * caught by the unit tests. These specs run against a real browser and assert
 * on measured geometry.
 *
 * Routine scripts select a small set of specs and only the projects relevant
 * to the changed behaviour. The scheduled/release matrix lives in
 * playwright.full.config.ts and is intentionally opt-in.
 */
export default defineConfig({
  testDir: './e2e',
  // Geometry assertions are deterministic; a retry would only mask flake in
  // the harness itself.
  retries: 0,
  fullyParallel: true,
  // Keep the shared Vite server responsive; focused runs value trustworthy
  // results over squeezing out a few seconds through worker contention.
  workers: process.env.CI ? 2 : 4,
  timeout: 60_000,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: focusedProjects,
  webServer: {
    command: `npm run dev -- --port ${devPort} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
