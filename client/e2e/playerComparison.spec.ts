import { test, expect } from '@playwright/test';
import { startScenario, boxOf, canHover, isCompact } from './helpers';

/**
 * Two player cards while a two-player action is being aimed.
 *
 * Deciding a block means holding the attacker's Strength against the
 * defender's. With one card that swapped on hover, that was a memory test: look
 * at the attacker, move the cursor, watch the attacker disappear.
 *
 * Scenario 006 is the fixture — it is the only one with humans and orcs already
 * in contact, so a Block is available without moving first.
 */
test.describe('two-player comparison', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!(await canHover(page)), 'the comparison is driven by hover');
    test.skip(await isCompact(page), 'the side rail is the wide layout');
    await startScenario(page, 'Loose Ball on the Goal Line');
  });

  /** Declares a Block on the human already in contact at 7F. */
  async function declareBlock(page: import('@playwright/test').Page) {
    await page.locator('.square[data-square="7F"] .piece').click();
    await page.locator('.piece-menu').waitFor({ state: 'visible' });
    await page.locator('.piece-menu__item', { hasText: 'Block' }).locator('input').check();
    await page.locator('.piece-menu__confirm').click();
    await expect(page.locator('.square--block-target').first()).toBeVisible();
  }

  test('shows one card until a second player is involved', async ({ page }) => {
    await page.locator('.square[data-square="7F"]').hover();
    await expect(page.locator('.side-col--right .panel')).toHaveCount(1);
    await expect(page.locator('.panel__role-tag')).toHaveCount(0);
  });

  test('adds the target below the attacker, each one labelled', async ({ page }) => {
    await declareBlock(page);
    await page.locator('.square[data-square="6F"]').hover();

    const panels = page.locator('.side-col--right .panel');
    await expect(panels).toHaveCount(2);
    await expect(panels.nth(0).locator('.panel__role-tag')).toHaveText('Acting');
    await expect(panels.nth(1).locator('.panel__role-tag')).toHaveText('Target');

    // The attacker stays put; the target arrives underneath it.
    const acting = await boxOf(panels.nth(0));
    const target = await boxOf(panels.nth(1));
    expect(target.y, 'target card sits below the acting card').toBeGreaterThan(acting.y);
  });

  test('both cards keep their stats readable', async ({ page }) => {
    await declareBlock(page);
    await page.locator('.square[data-square="6F"]').hover();

    const panels = page.locator('.side-col--right .panel');
    for (const index of [0, 1]) {
      await expect(panels.nth(index).locator('.panel__stat')).toHaveCount(4);
      await expect(panels.nth(index).locator('.panel__name')).toBeVisible();
    }
  });

  test('the pair fits the rail without pushing the page sideways', async ({ page }) => {
    await declareBlock(page);
    const boardBefore = await boxOf(page.locator('.pitch__grid'));

    await page.locator('.square[data-square="6F"]').hover();

    const rail = page.locator('.side-col--right');
    const fits = await rail.evaluate((el) => el.scrollHeight <= el.clientHeight + 1);
    const scrollable = await rail.evaluate((el) => getComputedStyle(el).overflowY);
    // Either it fits, or the rail scrolls — what it must never do is grow the
    // page or squeeze the board.
    expect(fits || scrollable === 'auto' || scrollable === 'scroll').toBe(true);

    const boardAfter = await boxOf(page.locator('.pitch__grid'));
    expect(boardAfter.width, 'board width unchanged').toBeCloseTo(boardBefore.width, 0);
  });

  test('drops back to one card when the cursor leaves', async ({ page }) => {
    await declareBlock(page);
    await page.locator('.square[data-square="6F"]').hover();
    await expect(page.locator('.side-col--right .panel')).toHaveCount(2);

    await page.locator('.hud__team').hover();

    await expect(page.locator('.side-col--right .panel')).toHaveCount(1);
    await expect(page.locator('.panel__role-tag')).toHaveCount(0);
  });
});
