import { test, expect } from '@playwright/test';
import { startGame, canHover } from './helpers';

/**
 * The two-stage tap contract.
 *
 * On a mouse the path preview follows hover, so the player sees the dodge
 * rolls and the running success chance before clicking. On touch there is no
 * hover: the synthetic mouseenter fires immediately before click, so preview
 * and commit used to land in the same tap and the player accepted risk they
 * were never shown. That is a game-design break in a puzzle about evaluating
 * risk, which is why it gets its own spec rather than living in layout.
 */
test.describe('touch: preview before commit', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(await canHover(page), 'the two-stage tap is for pointers that cannot hover');
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
    const match = status?.match(/(\d+) MA left/);
    return match ? Number(match[1]) : null;
  }

  test('the first tap previews without committing anything', async ({ page }) => {
    await selectAndMove(page);
    const maBefore = await remainingMa(page);

    await page.locator('.square--reachable').last().tap();

    await expect(page.locator('.square--preview-free, .square--preview-gfi, '
      + '.square--preview-dodge, .square--preview-gfi-dodge').first()).toBeVisible();
    await expect(page.locator('.commit-bar')).toBeVisible();

    // Nothing committed: no walked squares, and no movement spent.
    await expect(page.locator('.square--path')).toHaveCount(0);
    expect(await remainingMa(page), 'the first tap spent movement').toBe(maBefore);
  });

  test('the second tap on the same square commits the move', async ({ page }) => {
    await selectAndMove(page);
    const maBefore = await remainingMa(page);

    const target = page.locator('.square--reachable').last();
    // data-square is the stable identity. aria-label is not usable here: it
    // gains the preview's roll details ("dodge 4 plus") the moment the square
    // is armed, so a label captured beforehand no longer matches.
    const targetSquare = await target.getAttribute('data-square');

    await target.tap();
    await expect(page.locator('.commit-bar')).toBeVisible();

    await page.locator(`.square[data-square="${targetSquare}"]`).tap();

    await expect(page.locator('.commit-bar')).toBeHidden();
    // The destination is now a walked square on the committed path.
    await expect(page.locator(`.square[data-square="${targetSquare}"]`))
      .toHaveClass(/square--path/);
    const maAfter = await remainingMa(page);
    expect(maAfter, 'the second tap committed no movement').not.toBe(maBefore);
  });

  test('arming a move shows a confirm bar naming the destination', async ({ page }) => {
    await selectAndMove(page);
    await page.locator('.square--reachable').last().tap();

    const bar = page.locator('.commit-bar');
    await expect(bar).toBeVisible();
    // "Move to 12H" — the same square name the board and aria-labels use.
    await expect(bar.locator('.commit-bar__square')).toHaveText(/^Move to \d+[A-O]$/);
    await expect(bar.getByRole('button', { name: /confirm/i })).toBeVisible();
    await expect(bar.getByRole('button', { name: /cancel/i })).toBeVisible();
  });

  test('arming the confirm bar does not resize the pitch', async ({ page }) => {
    await selectAndMove(page);
    const bar = page.locator('.commit-bar');
    const pitch = page.locator('.pitch-wrapper');

    await expect(bar).toBeHidden();
    const before = await pitch.boundingBox();

    await page.locator('.square--reachable').last().tap();

    await expect(bar).toBeVisible();
    const after = await pitch.boundingBox();
    expect(after, 'the pitch moved or resized when the confirm bar appeared').toEqual(before);
  });

  test('cancelling an armed move commits nothing', async ({ page }) => {
    await selectAndMove(page);
    const maBefore = await remainingMa(page);

    await page.locator('.square--reachable').last().tap();
    await page.locator('.commit-bar').getByRole('button', { name: /cancel/i }).tap();

    await expect(page.locator('.commit-bar')).toBeHidden();
    await expect(page.locator('.square--path')).toHaveCount(0);
    expect(await remainingMa(page)).toBe(maBefore);
  });

  test('a route carrying a roll states its odds before it is accepted', async ({ page }) => {
    await selectAndMove(page);

    // The farthest reachable square is the one most likely to need a Go For
    // It or a dodge, which are the routes where the odds actually matter.
    await page.locator('.square--reachable').last().tap();
    await expect(page.locator('.commit-bar')).toBeVisible();

    const rolls = await page.locator('.square__dice').count();
    test.skip(rolls === 0, 'the farthest reachable square needs no roll here');

    // Before this change the odds were only accumulated on commit, so the
    // player accepted risk the interface had never quantified.
    await expect(page.locator('.commit-bar__prob')).toBeVisible();
    await expect(page.locator('.commit-bar__prob')).toHaveText(/^\d{1,3}% success$/);
  });
});
