import { devices, type PlaywrightTestConfig } from '@playwright/test';

type Projects = NonNullable<PlaywrightTestConfig['projects']>;

/**
 * Projects available to focused developer commands. A command should still
 * select only the projects that exercise the changed behaviour.
 */
export const focusedProjects: Projects = [
  {
    name: 'desktop',
    use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
  },
  {
    name: 'iphone-se',
    use: { ...devices['iPhone SE'] },
  },
  {
    name: 'iphone-14-landscape',
    use: { ...devices['iPhone 14 landscape'] },
  },
  {
    name: 'ipad-mini',
    use: { ...devices['iPad Mini'] },
  },
  {
    name: 'desktop-touch',
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width: 1280, height: 800 },
      hasTouch: true,
      isMobile: false,
    },
  },
];

const compactGeometry = /(?:layout|blockDialog|mobileControls)\.spec\.ts/;
const sizeAndInput = /(?:layout|inputAndSize)\.spec\.ts/;
const landscapeCoverage = /(?:layout|inputAndSize|mobileControls|actionLog|blockDialog)\.spec\.ts/;
const tabletCoverage = /(?:layout|inputAndSize|puzzleCreatorLayout)\.spec\.ts/;
const surfaceCoverage = /(?:layout|inputAndSize|blockDialog|home)\.spec\.ts/;
const phoneOnly = /(?:touch|actionLog|mobileControls)\.spec\.ts/;

/**
 * Scheduled/release coverage matrix.
 *
 * Two representative environments run almost everything. Regression-only
 * environments run only the specs capable of distinguishing them. This keeps
 * the same viewport/input boundaries without multiplying all 65 tests by every
 * device.
 */
export const fullProjects: Projects = [
  {
    name: 'desktop',
    testIgnore: phoneOnly,
    use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
  },
  {
    name: 'iphone-se',
    testIgnore: /playerComparison\.spec\.ts/,
    use: { ...devices['iPhone SE'] },
  },
  {
    name: 'galaxy-s8',
    testMatch: compactGeometry,
    use: { ...devices['Galaxy S8'] },
  },
  {
    name: 'iphone-xr-desktop-viewport',
    testMatch: sizeAndInput,
    use: {
      ...devices['iPhone XR'],
      viewport: { width: 980, height: 707 },
    },
  },
  {
    name: 'iphone-14-landscape',
    testMatch: landscapeCoverage,
    use: { ...devices['iPhone 14 landscape'] },
  },
  {
    name: 'ipad-mini',
    testMatch: tabletCoverage,
    use: { ...devices['iPad Mini'] },
  },
  {
    name: 'desktop-touch',
    testMatch: surfaceCoverage,
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width: 1280, height: 800 },
      hasTouch: true,
      isMobile: false,
    },
  },
];
