import { test, expect } from '@playwright/test';
import { boxOf, hasHorizontalOverflow } from './helpers';

test.describe('home account controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /play as guest/i }).click();
    await page.locator('.identity-gate__input').fill('E2E Tester');
    await page.getByRole('button', { name: /^continue$/i }).click();
  });

  test('the account trigger is prominent and anchored in the masthead corner', async ({ page }) => {
    const header = await boxOf(page.locator('.scenario-select__header'));
    const accountGroup = await boxOf(page.locator('.scenario-select__user'));
    const accountTrigger = await boxOf(page.getByRole('button', { name: /player menu for/i }));
    const avatar = await boxOf(page.locator('.scenario-select__user .user-menu__avatar'));

    expect(accountTrigger.height, 'account trigger height').toBeGreaterThanOrEqual(44);
    expect(Math.min(avatar.width, avatar.height), 'account avatar size').toBeGreaterThanOrEqual(34);
    expect(accountGroup.top - header.top, 'distance from masthead top').toBeLessThanOrEqual(13);
    expect(header.right - accountGroup.right, 'distance from masthead right').toBeLessThanOrEqual(13);
    if ((page.viewportSize()?.width ?? 0) <= 480) {
      await expect(page.locator('.scenario-select__version')).toBeHidden();
    }
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });
});
