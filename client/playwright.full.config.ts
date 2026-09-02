import { defineConfig } from '@playwright/test';
import focusedConfig from './playwright.config';
import { fullProjects } from './playwright.projects';

/**
 * Opt-in scheduled/release matrix. Do not use this for routine feature work;
 * choose one of the focused package scripts instead.
 */
export default defineConfig({
  ...focusedConfig,
  projects: fullProjects,
  outputDir: 'test-results/full',
});
