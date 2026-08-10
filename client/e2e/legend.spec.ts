import { test, expect } from '@playwright/test';
import { startGame, boxOf, isTouch } from './helpers';

/**
 * The pitch key is a toolbar panel, on every screen size.
 *
 * It used to be a permanent block under the HUD — two rows of colour chips plus
 * the two skill keys, always on. That is reference material charging rent in
 * the one dimension the board competes for, so these specs guard the two things
 * that make the move worth it: it costs no height while closed, and it is still
 * one interaction away.
 */
test.describe('pitch key', () => {
  test.beforeEach(async ({ page }) => {
    await startGame(page);
  });

  const open = async (page: import('@playwright/test').Page) => {
    const trigger = page.locator('.legend-menu__trigger');
    if (await isTouch(page)) await trigger.tap();
    else await trigger.click();
  };

  test('is a toolbar button, not a permanent row', async ({ page }) => {
    await expect(page.locator('.hud .legend-menu__trigger')).toBeVisible();
    // Nothing of the key is in the layout until it is asked for.
    await expect(page.locator('.game-legends')).toHaveCount(0);
  });

  test('opens the pitch and skill keys together', async ({ page }) => {
    await open(page);

    const panel = page.locator('.legend-menu__dropdown');
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('list', { name: 'Pitch state legend' })).toBeVisible();
    await expect(panel.getByRole('list', { name: 'Skill group color key' })).toBeVisible();
    await expect(panel.getByRole('list', { name: 'Exact skill marker key' })).toBeVisible();
    await expect(panel.getByText('Tackle Zone')).toBeVisible();
  });

  test('closes again without disturbing the board', async ({ page }) => {
    await open(page);
    await expect(page.locator('.legend-menu__dropdown')).toBeVisible();

    const before = await boxOf(page.locator('.pitch__grid'));
    await open(page);
    await expect(page.locator('.legend-menu__dropdown')).toBeHidden();

    // Opening and closing a panel must never resize the board underneath it.
    const after = await boxOf(page.locator('.pitch__grid'));
    expect(after.height).toBeCloseTo(before.height, 0);
  });

  test('the panel fits the viewport', async ({ page }) => {
    await open(page);

    const panel = await boxOf(page.locator('.legend-menu__dropdown'));
    const viewport = page.viewportSize();
    expect(panel.x, `panel starts at ${panel.x.toFixed(0)}px`).toBeGreaterThanOrEqual(-1);
    expect(
      panel.x + panel.width,
      `panel ends at ${(panel.x + panel.width).toFixed(0)}px of ${viewport?.width}px`,
    ).toBeLessThanOrEqual((viewport?.width ?? 0) + 1);
  });
});
