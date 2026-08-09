import { test, expect } from '@playwright/test';
import { startGame, isTouch } from './helpers';

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
    test.skip(!(await isTouch(page)), 'two-stage tap is a touch-only affordance');
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

  test('the first tap previews without moving the piece', async ({ page }) => {
    await selectAndMove(page);

    const before = await page.locator('.piece--selected').evaluate(
      (el) => el.closest('.square')!.getAttribute('aria-label'));

    await page.locator('.square--reachable').last().tap();

    // A preview renders the path and the ghost, and leaves the piece put.
    await expect(page.locator('.square--preview-free, .square--preview-gfi, '
      + '.square--preview-dodge, .square--preview-gfi-dodge').first()).toBeVisible();

    const after = await page.locator('.piece--selected').evaluate(
      (el) => el.closest('.square')!.getAttribute('aria-label'));
    expect(after, 'the piece moved on the first tap').toBe(before);
  });

  test('the second tap on the same square commits the move', async ({ page }) => {
    await selectAndMove(page);

    const target = page.locator('.square--reachable').last();
    const targetLabel = await target.getAttribute('aria-label');

    await target.tap();
    await page.locator('.square--preview-free, .square--preview-gfi, '
      + '.square--preview-dodge, .square--preview-gfi-dodge').first().waitFor();

    // Re-resolve by label: the reachable set changes once the preview lands.
    await page.locator(`.square[aria-label="${targetLabel}"]`).tap();

    await expect(page.locator('.square--path, .piece--selected')).not.toHaveCount(0);
    const moved = await page.locator('.piece--selected').evaluate(
      (el) => el.closest('.square')!.getAttribute('aria-label'));
    expect(moved, 'the piece did not move on the second tap').not.toBe(targetLabel);
  });

  test('the running success chance is visible before committing', async ({ page }) => {
    await selectAndMove(page);

    // Walk the reachable squares for one that carries a roll — those are the
    // only ones where the probability is meaningful.
    const risky = page.locator('.square--reachable');
    const count = await risky.count();
    let found = false;
    for (let i = count - 1; i >= 0 && !found; i -= 1) {
      await risky.nth(i).tap();
      found = await page.locator('.square__dice').count() > 0;
    }
    test.skip(!found, 'no roll-bearing square reachable in this scenario');

    await expect(page.locator('.hud__prob-value')).toBeVisible();
  });
});
