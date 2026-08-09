import { test, expect } from '@playwright/test';
import {
  startGame, boxOf, clippedSquares, hasHorizontalOverflow, undersizedTapTargets,
  isPortrait, isTouch, isCompact, MIN_SQUARE_SIZE_PORTRAIT, MIN_SQUARE_SIZE_LANDSCAPE, MIN_TAP_TARGET,
} from './helpers';

/**
 * Geometry invariants for the game screen.
 *
 * These assert on measured boxes rather than screenshots, so a failure names
 * a number rather than "pixels differ". Every one of them failed on the
 * pre-portrait build; the values in the failure messages are what makes a
 * regression arguable-with.
 */
test.describe('game screen layout', () => {
  test.beforeEach(async ({ page }) => {
    await startGame(page);
  });

  test('no pitch square is clipped out of view', async ({ page }) => {
    const clipped = await clippedSquares(page);
    expect(
      clipped.count,
      `${clipped.count} squares render outside .pitch-wrapper (overflow: hidden), `
      + `in rows [${clipped.rows.join(', ')}] — they are invisible and unclickable`,
    ).toBe(0);
  });

  test('the page does not scroll sideways', async ({ page }) => {
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test('squares are large enough to tap', async ({ page }) => {
    test.skip(!(await isCompact(page)), 'the size floor is about a cramped viewport');

    const floor = isPortrait(page) ? MIN_SQUARE_SIZE_PORTRAIT : MIN_SQUARE_SIZE_LANDSCAPE;
    const square = await boxOf(page.locator('.pitch__grid .square').first());
    expect(
      Math.min(square.width, square.height),
      `squares measure ${square.width.toFixed(1)}×${square.height.toFixed(1)}px `
      + `(floor ${floor} for this orientation)`,
    ).toBeGreaterThanOrEqual(floor);
  });

  test('the board spends nearly all the width available to it', async ({ page }) => {
    test.skip(!isPortrait(page) || !(await isCompact(page)), 'compact portrait viewports only');

    // The absolute floor above cannot distinguish "laid out well on a small
    // screen" from "laid out badly on a large one" — 15 columns across a
    // 320px phone can never beat ~20px however good the layout is. This is
    // the assertion that actually catches wasted space: the old landscape
    // board used 85% of the width and then threw two thirds of the height
    // away centring a squashed pitch inside it.
    const viewport = page.viewportSize()!;
    const grid = await boxOf(page.locator('.pitch__grid'));
    expect(
      grid.width / viewport.width,
      `board is ${grid.width.toFixed(0)}px wide in a ${viewport.width}px viewport`,
    ).toBeGreaterThan(0.9);
  });

  test('interactive controls meet the tap-target minimum', async ({ page }) => {
    test.skip(!(await isTouch(page)), 'tap-target floor applies to touch devices');

    const undersized = await undersizedTapTargets(page);
    expect(
      undersized,
      `controls below ${MIN_TAP_TARGET}px: `
      + undersized.map((u) => `"${u.label}" ${u.width}×${u.height}`).join(', '),
    ).toEqual([]);
  });

  test('the report launcher stays visually tucked away', async ({ page }) => {
    const reportButton = page.getByRole('button', { name: 'Report a problem' });
    const box = await boxOf(reportButton);
    const background = await reportButton.evaluate((button) => getComputedStyle(button).backgroundColor);

    if (await isTouch(page)) {
      expect(Math.min(box.width, box.height), 'touch hit target').toBeGreaterThanOrEqual(MIN_TAP_TARGET);
    } else {
      expect(Math.max(box.width, box.height), 'pointer-sized launcher').toBeLessThanOrEqual(32);
    }
    expect(background, 'idle launcher background').toBe('rgba(0, 0, 0, 0)');
  });

  test('chrome stays within its budget', async ({ page }) => {
    test.skip(!(await isCompact(page)), 'the chrome budget is a cramped-viewport concern');

    const hud = await boxOf(page.locator('.hud'));
    const grid = await boxOf(page.locator('.pitch__grid'));

    // One row of 44px controls plus padding. The HUD used to be 121px — 15%
    // of an 812px screen — for a back button, a percentage and four icons,
    // while the board got 204px. An absolute budget rather than a percentage
    // of viewport height: the row costs the same on every phone, so a share
    // of the height would just be stricter on small screens for no reason.
    expect(hud.height, `HUD is ${hud.height.toFixed(0)}px tall`).toBeLessThanOrEqual(68);

    // Whatever the chrome costs, the board outweighs all of it put together.
    const legend = await boxOf(page.locator('.game-legends'));
    const status = await boxOf(page.locator('.status-strip'));
    const chrome = hud.height + legend.height + status.height;
    expect(
      grid.height,
      `board ${grid.height.toFixed(0)}px vs ${chrome.toFixed(0)}px of chrome`,
    ).toBeGreaterThan(chrome);
  });

  test('the board is rendered portrait on portrait screens', async ({ page }) => {
    test.skip(!isPortrait(page) || !(await isCompact(page)), 'compact portrait viewports only');

    const grid = await boxOf(page.locator('.pitch__grid'));
    expect(
      grid.height,
      `grid is ${grid.width.toFixed(0)}×${grid.height.toFixed(0)} — expected taller than wide`,
    ).toBeGreaterThan(grid.width);
  });

  test('square labels keep their identity across orientations', async ({ page }) => {
    // A square is named "<number><letter>" regardless of how the board is
    // drawn, so written solutions and bug reports stay valid. The accessible
    // name carries it.
    const label = await page.locator('.square[data-col="7"][data-row="7"]')
      .first().getAttribute('aria-label');
    expect(label).toMatch(/^7H,/);
  });

  test('grid coordinates remain visible around the pitch', async ({ page }) => {
    const portraitPitch = await page.locator('.pitch').evaluate((pitch) =>
      pitch.classList.contains('pitch--portrait'),
    );
    const topLabels = page.locator('.pitch__col-labels--top .pitch__col-label');
    const leftLabels = page.locator('.pitch__middle > .pitch__row-labels:first-child .pitch__row-label');

    await expect(topLabels.first()).toBeVisible();
    await expect(leftLabels.first()).toBeVisible();
    await expect(topLabels).toHaveText(portraitPitch
      ? Array.from({ length: 15 }, (_, index) => String.fromCharCode(65 + index))
      : Array.from({ length: 26 }, (_, index) => String(index)));
    await expect(leftLabels).toHaveText(portraitPitch
      ? Array.from({ length: 26 }, (_, index) => String(index))
      : Array.from({ length: 15 }, (_, index) => String.fromCharCode(65 + index)));
  });
});

test.describe('modals fit the viewport', () => {
  test('no dialog overflows the screen edge', async ({ page }) => {
    await startGame(page);
    const viewport = page.viewportSize()!;

    // The block outcome panel carried min-width: 420px, which beat the
    // width: calc(100vw - 20px) override and pushed its right edge 30px past
    // a 360px screen — inside a fixed backdrop, so it could not be scrolled to.
    const overflowing = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.className = 'modal-backdrop';
      probe.innerHTML = '<div class="modal block-outcome">probe</div>';
      document.body.appendChild(probe);
      const el = probe.querySelector('.block-outcome')!;
      const r = el.getBoundingClientRect();
      const result = { width: r.width, right: r.right, left: r.left };
      probe.remove();
      return result;
    });

    expect(
      overflowing.width,
      `.block-outcome is ${overflowing.width}px wide in a ${viewport.width}px viewport`,
    ).toBeLessThanOrEqual(viewport.width);
    expect(overflowing.right).toBeLessThanOrEqual(viewport.width + 1);
    expect(overflowing.left).toBeGreaterThanOrEqual(-1);
  });
});
