import { test, expect } from '@playwright/test';
import { boxOf, hasHorizontalOverflow } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /play as guest/i }).click();
  await page.locator('.identity-gate__input').fill('Settings Preview Tester');
  await page.getByRole('button', { name: /^continue$/i }).click();
  await page.getByRole('button', { name: /player menu for/i }).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();
  await page.getByRole('heading', { name: 'Settings' }).waitFor();
});

test('token-style pitch previews stay clear and contained', async ({ page }) => {
  const options = page.locator('.settings-screen__token-option');
  const previews = page.locator('.settings-screen__token-preview img');

  await expect(options).toHaveCount(3);
  await expect(previews).toHaveCount(3);
  await expect.poll(() => previews.evaluateAll(images => images.map(image => (
    image instanceof HTMLImageElement ? image.naturalWidth : 0
  )))).toEqual([1536, 1536, 1536]);

  const firstOption = await boxOf(options.first());
  const firstPreview = await boxOf(previews.first());
  expect(firstPreview.width).toBeGreaterThanOrEqual(90);
  expect(firstPreview.height).toBeGreaterThanOrEqual(60);
  expect(firstPreview.left).toBeGreaterThanOrEqual(firstOption.left);
  expect(firstPreview.right).toBeLessThanOrEqual(firstOption.right);
  expect(await hasHorizontalOverflow(page)).toBe(false);
});
