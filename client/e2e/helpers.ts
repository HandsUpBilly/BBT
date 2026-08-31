import type { Page, Locator } from '@playwright/test';

/** Apple's minimum is 44pt; Android's is 48dp. 44 is the value we hold to. */
export const MIN_TAP_TARGET = 44;

/**
 * Minimum pitch square size, in CSS px, by viewport shape.
 *
 * Both are below the 44px tap-target minimum on purpose. A pitch square is a
 * forgiving target — a mis-tap only plots a route, and the explicit
 * confirmation gives the player a chance to correct it — and 44px is not
 * reachable anyway: 15 columns at 44px needs a 660px-wide phone.
 *
 * The two numbers differ because a different axis binds in each case.
 * Portrait is width-bound at 15 columns, so the ceiling is roughly
 * viewportWidth ÷ 15 — about 20px on a 320px phone and 24px on a 375px one.
 * Landscape is height-bound at 15 rows in a viewport barely 340px tall, and
 * no layout recovers more than about 17px there.
 *
 * A single absolute floor cannot express that, and picking the lower of the
 * two would stop the harness noticing a portrait regression. See also the
 * relative width-usage assertion in layout.spec.ts, which is what actually
 * catches wasted space; these are a backstop against outright collapse.
 */
// WebKit reports the 19px CSS track as 18.92px after device-scale rounding.
export const MIN_SQUARE_SIZE_PORTRAIT = 18.9;
export const MIN_SQUARE_SIZE_LANDSCAPE = 15;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** Read an element's viewport-relative box. Throws if the element is absent. */
export async function boxOf(locator: Locator): Promise<Box> {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      x: r.x, y: r.y, width: r.width, height: r.height,
      top: r.top, bottom: r.bottom, left: r.left, right: r.right,
    };
  });
}

/**
 * Sign in as a guest and start the featured series, leaving the page on the
 * game screen with the pitch rendered.
 *
 * Goes through the real UI rather than seeding state directly, so the
 * geometry under test is the geometry a player actually gets.
 */
export async function startGame(page: Page, playerName = 'E2E Tester'): Promise<void> {
  await page.goto('/');

  await page.getByRole('button', { name: /play as guest/i }).click();

  const nameInput = page.locator('.identity-gate__input');
  await nameInput.fill(playerName);
  await page.getByRole('button', { name: /^continue$/i }).click();

  await page.getByRole('button', { name: /^(start series|tutorial)$/i }).click();
  await page.getByRole('button', { name: /^(play this drill|play)$/i }).first().click();

  // The pitch is the signal that the game screen has actually mounted.
  await page.locator('.pitch__grid .square').first().waitFor({ state: 'visible' });

  // A fresh identity sees the first Tutorial lesson before the board accepts
  // input. Layout tests exercise the game surface itself, so acknowledge it.
  const startPuzzle = page.getByRole('button', { name: 'Begin Puzzle' });
  if (await startPuzzle.isVisible()) await startPuzzle.click();
  const skipGuide = page.getByRole('button', { name: 'Skip guide' });
  if (await skipGuide.isVisible()) await skipGuide.click();
}

/**
 * Starts one named puzzle from the individual-puzzle picker rather than the series.
 *
 * Some behaviour needs a specific board — a Block, for instance, needs the two
 * teams already in contact, which only "Loose Ball on the Goal Line" gives you
 * without moving first.
 */
export async function startScenario(
  page: Page,
  scenarioName: string,
  playerName = 'E2E Tester',
): Promise<void> {
  await page.goto('/');

  await page.getByRole('button', { name: /play as guest/i }).click();
  await page.locator('.identity-gate__input').fill(playerName);
  await page.getByRole('button', { name: /^continue$/i }).click();

  await page.getByRole('tab', { name: /single plays|free play/i }).click();
  await page.locator('.challenge-tile', { hasText: scenarioName })
    .getByRole('button', { name: /^play$/i }).click();

  await page.locator('.pitch__grid .square').first().waitFor({ state: 'visible' });

  // Single-play puzzles can show the same first-visit briefing as a series
  // puzzle. A modal left over the board intercepts every interaction in the
  // scenario-specific layout specs.
  const beginPuzzle = page.getByRole('button', { name: 'Begin Puzzle' });
  if (await beginPuzzle.isVisible()) await beginPuzzle.click();
  const skipGuide = page.getByRole('button', { name: 'Skip guide' });
  if (await skipGuide.isVisible()) await skipGuide.click();
}

/**
 * Every pitch square that renders outside its scroll container.
 *
 * `.pitch-wrapper` has `overflow: hidden`, so anything outside it is both
 * invisible and unclickable — the failure mode that made landscape phones
 * unplayable.
 */
export async function clippedSquares(page: Page): Promise<{ count: number; rows: string[] }> {
  return page.evaluate(() => {
    const wrapper = document.querySelector('.pitch-wrapper');
    if (!wrapper) return { count: 0, rows: [] };
    const w = wrapper.getBoundingClientRect();
    const clipped = [...document.querySelectorAll('.square')].filter((s) => {
      const r = s.getBoundingClientRect();
      // 0.5px tolerance absorbs sub-pixel rounding on fractional-DPR devices.
      return r.bottom > w.bottom + 0.5 || r.top < w.top - 0.5
        || r.right > w.right + 0.5 || r.left < w.left - 0.5;
    });
    return {
      count: clipped.length,
      rows: [...new Set(clipped.map((s) => (s as HTMLElement).dataset.row ?? '?'))].sort(),
    };
  });
}

/** True when the document scrolls sideways — always a layout bug on mobile. */
export async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
}

/** Interactive elements smaller than the tap-target minimum, with their labels. */
export async function undersizedTapTargets(
  page: Page,
  minimum: number = MIN_TAP_TARGET,
): Promise<{ label: string; width: number; height: number }[]> {
  return page.evaluate((min) => {
    const selector = 'button, a[href], input:not([type=hidden]), select, [role=button]';
    return [...document.querySelectorAll(selector)]
      // Pitch squares are held to their own (lower) bar — see MIN_SQUARE_SIZE.
      .filter((el) => !el.classList.contains('square'))
      .filter((el) => {
        const cs = getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          label: (el.getAttribute('aria-label') || el.textContent || el.tagName)
            .trim().slice(0, 32),
          width: Math.round(r.width),
          height: Math.round(r.height),
        };
      })
      .filter((m) => m.width > 0 && m.height > 0)
      .filter((m) => m.width < min || m.height < min);
  }, minimum);
}

/** True when the viewport is taller than it is wide. */
export function isPortrait(page: Page): boolean {
  const size = page.viewportSize();
  return size !== null && size.height >= size.width;
}

/**
 * True when the project emulates touch.
 *
 * Use only for hit-target and interaction questions. It is NOT a stand-in for
 * "small screen" — a touchscreen laptop is coarse and roomy at once, and
 * treating the two as the same thing is what collapsed the phone layout onto
 * a 1280px display.
 */
export async function isTouch(page: Page): Promise<boolean> {
  return page.evaluate(() => matchMedia('(pointer: coarse)').matches);
}

/** True when the viewport is too narrow for the three-column layout. */
export async function isCompact(page: Page): Promise<boolean> {
  return page.evaluate(() => matchMedia('(max-width: 1024px)').matches);
}

/** True when any connected input can hover, so the preview can follow it. */
export async function canHover(page: Page): Promise<boolean> {
  return page.evaluate(() => matchMedia('(any-hover: hover)').matches);
}
