import { test, expect } from '@playwright/test';
import { startGame, boxOf, MIN_TAP_TARGET, undersizedTapTargets } from './helpers';

/**
 * Screen size, hover capability and pointer precision are three independent
 * questions, and the layout must answer each with the right one.
 *
 * Two shipped defects came from conflating them. Deciding by width alone gave
 * a landscape phone (812px) the desktop layout and clipped 40% of the board.
 * Deciding by pointer alone then gave a 1280px touchscreen the phone layout:
 * side columns hidden, ~740px of dead space beside a shrunken board, and no
 * hover preview on hardware perfectly able to hover.
 *
 * The `desktop-touch` project is the case that catches the second one.
 */

/** What the browser reports, so a failure says which query disagreed. */
async function capabilities(page: import('@playwright/test').Page) {
  return page.evaluate(() => ({
    coarse: matchMedia('(pointer: coarse)').matches,
    hover: matchMedia('(any-hover: hover)').matches,
    compact: matchMedia('(max-width: 1024px)').matches,
    width: window.innerWidth,
  }));
}

test.describe('layout follows size, not input', () => {
  test.beforeEach(async ({ page }) => {
    await startGame(page);
  });

  test('a wide viewport keeps its side columns whatever is pointing at it', async ({ page }) => {
    const caps = await capabilities(page);
    test.skip(caps.compact, 'this is the wide-viewport contract');

    const left = await boxOf(page.locator('.side-col--left'));
    const right = await boxOf(page.locator('.side-col--right'));

    expect(left.width, `left rail collapsed at ${caps.width}px (coarse: ${caps.coarse})`)
      .toBeGreaterThan(0);
    expect(right.width).toBeGreaterThan(0);

    // The compact-only surfaces must not appear alongside them.
    await expect(page.locator('.info-sheet')).toHaveCount(0);
    await expect(page.locator('.hud .action-log-menu')).toHaveCount(0);
    await expect(page.locator('.status-strip')).toHaveCount(0);
  });

  test('a wide viewport does not leave the board stranded', async ({ page }) => {
    const caps = await capabilities(page);
    test.skip(caps.compact, 'this is the wide-viewport contract');

    const area = await boxOf(page.locator('.game-area'));
    const grid = await boxOf(page.locator('.pitch__grid'));
    const rails = (await boxOf(page.locator('.side-col--left'))).width
      + (await boxOf(page.locator('.side-col--right'))).width;

    // Board, rails and gaps should account for nearly all the row. Before the
    // fix the board used 526px of a 1270px area and the rails used none.
    const used = grid.width + rails;
    expect(
      used / area.width,
      `board ${grid.width.toFixed(0)}px + rails ${rails.toFixed(0)}px `
      + `of a ${area.width.toFixed(0)}px row`,
    ).toBeGreaterThan(0.9);
  });

  test('the action log occupies the rail rather than nothing', async ({ page }) => {
    test.skip((await capabilities(page)).compact, 'wide viewports only');
    // Rendered nothing until the first move, leaving the rail blank.
    await expect(page.locator('.side-col--left .dice-log')).toBeVisible();
    await expect(page.locator('.side-col--left .dice-log__empty')).toBeVisible();
  });

  test('the player card fills the right rail', async ({ page }) => {
    test.skip((await capabilities(page)).compact, 'wide viewports only');

    const rail = await boxOf(page.locator('.side-col--right'));
    const panel = await boxOf(page.locator('.side-col--right .panel'));

    expect(panel.width, 'the player card left unused space in its rail')
      .toBeCloseTo(rail.width, 1);
  });

  test('a compact viewport moves those surfaces out of the rails', async ({ page }) => {
    test.skip(!(await capabilities(page)).compact, 'this is the compact contract');

    await expect(page.locator('.side-col--left')).toBeHidden();
    await expect(page.locator('.info-sheet')).toBeVisible();
    await expect(page.locator('.hud .action-log-menu')).toBeVisible();
  });
});

test.describe('interaction follows hover capability', () => {
  test.beforeEach(async ({ page }) => {
    await startGame(page);
  });

  test('hovering previews a route without committing it', async ({ page }) => {
    test.skip(!(await capabilities(page)).hover, 'requires a hovering pointer');

    const carrier = page.locator('.square:has(.piece--carrier)').first();
    await carrier.click();
    await page.locator('.piece-menu').waitFor({ state: 'visible' });
    await page.getByText('Move', { exact: true }).click();
    await page.getByRole('button', { name: /confirm/i }).click();
    await page.locator('.square--reachable').first().waitFor();

    await page.locator('.square--reachable').last().hover();

    // The preview appears from the hover alone — no click, no final decision.
    await expect(page.locator('.square--preview-free, .square--preview-gfi, '
      + '.square--preview-dodge, .square--preview-gfi-dodge').first()).toBeVisible();
    await expect(page.locator('.move-decision')).toHaveCount(0);
    await expect(page.locator('.square--path')).toHaveCount(0);
  });

  test('waypoints stay open until the route endpoint is double-clicked', async ({ page }) => {
    test.skip(!(await capabilities(page)).hover, 'requires a hovering pointer');

    const carrier = page.locator('.square:has(.piece--carrier)').first();
    await carrier.click();
    await page.locator('.piece-menu').waitFor({ state: 'visible' });
    await page.getByText('Move', { exact: true }).click();
    await page.getByRole('button', { name: /confirm/i }).click();

    const target = page.locator('.square--reachable').last();
    const targetSquare = await target.getAttribute('data-square');
    await target.hover();
    await target.click();

    await expect(page.locator('.move-decision')).toHaveCount(0);
    await expect(page.locator(`.square[data-square="${targetSquare}"]`)).toHaveClass(/square--path/);

    await page.locator(`.square[data-square="${targetSquare}"]`).dblclick();
    const decision = page.locator('.move-decision');
    await expect(decision.getByRole('button', { name: 'Confirm Move' })).toBeVisible();
    await expect(decision.getByRole('button', { name: 'Plot Again' })).toBeVisible();
  });

  test('a non-hovering pointer plots the route with its first tap', async ({ page }) => {
    test.skip((await capabilities(page)).hover, 'requires a non-hovering pointer');

    const carrier = page.locator('.square:has(.piece--carrier)').first();
    await carrier.tap();
    await page.locator('.piece-menu').waitFor({ state: 'visible' });
    await page.getByText('Move', { exact: true }).tap();
    await page.getByRole('button', { name: /confirm/i }).tap();
    await page.locator('.square--reachable').first().waitFor();

    await page.locator('.square--reachable').last().tap();
    await expect(page.locator('.move-decision')).toHaveCount(0);
  });
});

test.describe('hit targets follow pointer precision', () => {
  test('a coarse pointer gets 44px controls even on a large screen', async ({ page }) => {
    await startGame(page);
    const caps = await capabilities(page);
    test.skip(!caps.coarse, 'coarse pointers only');

    const undersized = await undersizedTapTargets(page);
    expect(
      undersized,
      `at ${caps.width}px wide, controls below ${MIN_TAP_TARGET}px: `
      + undersized.map(u => `"${u.label}" ${u.width}×${u.height}`).join(', '),
    ).toEqual([]);
  });
});
