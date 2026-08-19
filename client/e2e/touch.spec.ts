import { test, expect } from '@playwright/test';
import { startGame, canHover } from './helpers';

/**
 * The plot-then-confirm contract.
 *
 * On a mouse the path preview follows hover, so the player sees the dodge
 * rolls and the running success chance before clicking. On touch there is no
 * hover, so the first tap previews and the second adds a waypoint. The player
 * then taps that already-plotted endpoint once to expose the final decision.
 */
test.describe('touch: plot before commit', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(await canHover(page), 'this suite covers pointers that cannot hover');
    await startGame(page);
  });

  /** Tap a piece and choose Move from the piece menu, leaving it selected. */
  async function selectAndMove(page: import('@playwright/test').Page) {
    const carrier = page.locator('.square:has(.piece--carrier)').first();
    await carrier.tap();
    await page.locator('.piece-menu').waitFor({ state: 'visible' });
    await page.getByText('Move', { exact: true }).tap();
    await page.getByRole('button', { name: /confirm/i }).tap();
    await page.locator('.square--reachable').first().waitFor({ state: 'visible' });
  }

  /**
   * Remaining movement, read from the HUD status line.
   *
   * The obvious assertion — "did the piece element move?" — proves nothing
   * here: a piece keeps its board position for the whole activation and is
   * only relocated when the activation is finalised, with a ghost marking the
   * path tip meanwhile. Committed movement shows up as spent MA and as
   * `.square--path` squares, so those are what these tests check.
   */
  async function remainingMa(page: import('@playwright/test').Page): Promise<number | null> {
    const status = await page.locator('.hud__status').textContent();
    const match = status?.match(/(\d+) MA (?:left|remaining)/);
    return match ? Number(match[1]) : null;
  }

  test('the first tap previews without committing anything', async ({ page }) => {
    await selectAndMove(page);
    const maBefore = await remainingMa(page);

    await page.locator('.square--reachable').last().tap();

    await expect(page.locator('.square--preview-free, .square--preview-gfi, '
      + '.square--preview-dodge, .square--preview-gfi-dodge').first()).toBeVisible();
    await expect(page.locator('.move-decision')).toHaveCount(0);

    // Nothing committed: no walked squares, and no movement spent.
    await expect(page.locator('.square--path')).toHaveCount(0);
    expect(await remainingMa(page), 'the first tap spent movement').toBe(maBefore);
  });

  test('a second tap adds a waypoint without finishing the whole route', async ({ page }) => {
    await selectAndMove(page);
    const maBefore = await remainingMa(page);

    const target = page.locator('.square--reachable').last();
    // data-square is the stable identity. aria-label is not usable here: it
    // gains the preview's roll details ("dodge 4 plus") the moment the square
    // is armed, so a label captured beforehand no longer matches.
    const targetSquare = await target.getAttribute('data-square');

    await target.tap();
    await expect(page.locator('.move-decision')).toHaveCount(0);

    await page.locator(`.square[data-square="${targetSquare}"]`).tap();

    await expect(page.locator('.move-decision')).toHaveCount(0);
    await expect(page.locator(`.square[data-square="${targetSquare}"]`))
      .toHaveClass(/square--path/);
    const maAfter = await remainingMa(page);
    expect(maAfter, 'the second tap added no waypoint').not.toBe(maBefore);
  });

  test('tapping the completed endpoint shows the final decision', async ({ page }) => {
    await selectAndMove(page);
    const target = page.locator('.square--reachable').last();
    const targetSquare = await target.getAttribute('data-square');
    await target.tap();
    const endpoint = page.locator(`.square[data-square="${targetSquare}"]`);
    await endpoint.tap();
    await endpoint.tap();

    const decision = page.locator('.move-decision');
    await expect(decision).toBeVisible();
    await expect(decision.getByRole('button', { name: 'Confirm Move' })).toHaveText('✓');
    await expect(decision.getByRole('button', { name: 'Plot Again' })).toHaveText('×');
  });

  test('showing the endpoint decision does not resize the pitch', async ({ page }) => {
    await selectAndMove(page);
    const decision = page.locator('.move-decision');
    const pitch = page.locator('.pitch-wrapper');

    await expect(decision).toHaveCount(0);
    const before = await pitch.boundingBox();

    const target = page.locator('.square--reachable').last();
    const targetSquare = await target.getAttribute('data-square');
    await target.tap();
    const endpoint = page.locator(`.square[data-square="${targetSquare}"]`);
    await endpoint.tap();
    await endpoint.tap();

    await expect(decision).toBeVisible();
    const after = await pitch.boundingBox();
    expect(after, 'the pitch moved or resized when the endpoint decision appeared').toEqual(before);
  });

  test('Plot Again rewinds every provisional waypoint', async ({ page }) => {
    await selectAndMove(page);
    const maBefore = await remainingMa(page);

    const target = page.locator('.square--reachable').last();
    const targetSquare = await target.getAttribute('data-square');
    await target.tap();
    const endpoint = page.locator(`.square[data-square="${targetSquare}"]`);
    await endpoint.tap();
    await endpoint.tap();
    await page.locator('.move-decision').getByRole('button', { name: 'Plot Again' }).tap();

    await expect(page.locator('.move-decision')).toHaveCount(0);
    await expect(page.locator('.square--path')).toHaveCount(0);
    expect(await remainingMa(page)).toBe(maBefore);
  });

  test('a route carrying a roll states its odds before it is accepted', async ({ page }) => {
    await selectAndMove(page);

    // The farthest reachable square is the one most likely to need a Go For
    // It or a dodge, which are the routes where the odds actually matter.
    const target = page.locator('.square--reachable').last();
    const targetSquare = await target.getAttribute('data-square');
    await target.tap();

    const rolls = await page.locator('.square__dice').count();
    test.skip(rolls === 0, 'the farthest reachable square needs no roll here');

    // Before this change the odds were only accumulated on commit, so the
    // player accepted risk the interface had never quantified.
    const endpoint = page.locator(`.square[data-square="${targetSquare}"]`);
    await endpoint.tap();
    await endpoint.tap();
    await expect(page.locator('.move-decision__prob')).toBeVisible();
    await expect(page.locator('.move-decision__prob')).toHaveText(/^\d{1,3}%$/);
  });
});
