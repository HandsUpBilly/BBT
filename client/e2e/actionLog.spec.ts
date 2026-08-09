import { test, expect } from '@playwright/test';
import { startGame, isTouch } from './helpers';

/**
 * The action log lives in the toolbar on touch, and must agree with itself.
 *
 * Two separate defects met here. The display compaction folded consecutive
 * roll-bearing steps into one line, so two Go For It rushes appeared as one.
 * And the "Cumulative" figure multiplied the committed probability by
 * pendingProb, which already contained the same rolls, so it reported 0.833⁴
 * where the truth — and the submitted score — was 0.833².
 */
test.describe('action log', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!(await isTouch(page)), 'the toolbar log is the touch layout');
    await startGame(page);
  });

  /** Walk the carrier until it runs out of movement, forcing Go For It rolls. */
  async function walkToExhaustion(page: import('@playwright/test').Page) {
    const carrier = page.locator('.square:has(.piece--carrier)').first();
    await carrier.tap();
    await page.locator('.piece-menu').waitFor({ state: 'visible' });
    await page.getByText('Move', { exact: true }).tap();
    await page.getByRole('button', { name: /confirm/i }).tap();

    for (let i = 0; i < 5; i += 1) {
      const reachable = page.locator('.square--reachable');
      if (await reachable.count() === 0) break;
      const target = reachable.last();
      const square = await target.getAttribute('data-square');
      await target.tap();
      await page.locator(`.square[data-square="${square}"]`).tap();
    }
  }

  test('opens from the toolbar, not from a sheet under the board', async ({ page }) => {
    await expect(page.locator('.hud .action-log-menu__trigger')).toBeVisible();
    // The roll history no longer has a tab under the board.
    await expect(page.locator('.info-sheet__tab')).toHaveCount(1);

    await page.locator('.action-log-menu__trigger').tap();
    const panel = page.locator('.action-log-menu__dropdown');
    await expect(panel).toBeVisible();
    // Nothing has happened yet, so the panel says so rather than showing an
    // empty frame.
    await expect(panel.locator('.action-log-menu__empty')).toBeVisible();

    // Tapping the board dismisses the panel, so reopen it after moving.
    await walkToExhaustion(page);
    await page.locator('.action-log-menu__trigger').tap();
    await expect(panel.locator('.dice-log__title')).toHaveText('Action Log');
  });

  test('closes on a tap outside', async ({ page }) => {
    await page.locator('.action-log-menu__trigger').tap();
    await expect(page.locator('.action-log-menu__dropdown')).toBeVisible();

    await page.locator('.hud__team').tap();
    await expect(page.locator('.action-log-menu__dropdown')).toBeHidden();
  });

  test('lists every roll it counted, and totals them once', async ({ page }) => {
    await walkToExhaustion(page);
    await page.locator('.action-log-menu__trigger').tap();

    const panel = page.locator('.action-log-menu__dropdown');
    await expect(panel).toBeVisible();

    // Each listed roll shows its own chance; the footer shows their product.
    const shown = await panel.locator('.dice-log__prob-pct').allTextContents();
    const factors = shown.map(t => Number(t.replace(/[()%]/g, '')) / 100);
    test.skip(factors.length === 0, 'this scenario reached no roll');

    const expected = factors.reduce((a, b) => a * b, 1);
    const footer = await panel.locator('.dice-log__prob-total').textContent();
    const actual = Number((footer ?? '').replace('%', '')) / 100;

    expect(
      actual,
      `footer says ${footer}, the ${factors.length} listed rolls multiply to `
      + `${(expected * 100).toFixed(1)}%`,
    ).toBeCloseTo(expected, 2);
  });

  test('the badge counts the rolls, not the steps', async ({ page }) => {
    await walkToExhaustion(page);

    const badge = page.locator('.action-log-menu__count');
    await expect(badge).toBeVisible();

    await page.locator('.action-log-menu__trigger').tap();
    const listed = await page.locator('.action-log-menu__dropdown .dice-log__prob-pct').count();
    expect(Number(await badge.textContent())).toBe(listed);
  });
});
