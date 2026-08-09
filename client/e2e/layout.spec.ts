import { test, expect } from '@playwright/test';
import {
  startGame, boxOf, clippedSquares, hasHorizontalOverflow, undersizedTapTargets,
  isPortrait, isTouch, MIN_SQUARE_SIZE, MIN_TAP_TARGET,
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
    test.skip(!(await isTouch(page)), 'tap-size floor applies to touch devices');

    const square = await boxOf(page.locator('.pitch__grid .square').first());
    expect(
      Math.min(square.width, square.height),
      `squares measure ${square.width.toFixed(1)}×${square.height.toFixed(1)}px`,
    ).toBeGreaterThanOrEqual(MIN_SQUARE_SIZE);
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

  test('the board gets the majority of the screen height', async ({ page }) => {
    test.skip(!(await isTouch(page)), 'chrome budget is a mobile concern');

    const viewport = page.viewportSize()!;
    const hud = await boxOf(page.locator('.hud'));
    const grid = await boxOf(page.locator('.pitch__grid'));

    // The HUD used to take 121px of 812 (15%) while the board took 204px.
    expect(hud.height, `HUD is ${hud.height.toFixed(0)}px tall`)
      .toBeLessThanOrEqual(viewport.height * 0.12);
    expect(
      grid.height,
      `board is ${grid.height.toFixed(0)}px of ${viewport.height}px viewport`,
    ).toBeGreaterThan(viewport.height * 0.5);
  });

  test('the board is rendered portrait on portrait screens', async ({ page }) => {
    test.skip(!isPortrait(page) || !(await isTouch(page)), 'portrait touch devices only');

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
