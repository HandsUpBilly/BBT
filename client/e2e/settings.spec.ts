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

test('game HUD keeps the account menu and Settings reachable', async ({ page }) => {
  await page.getByRole('button', { name: '← Back' }).click();
  await page.getByRole('button', { name: /start series/i }).click();
  await page.getByRole('button', { name: 'Play this drill' }).first().click();
  await page.locator('.pitch__grid .square').first().waitFor({ state: 'visible' });
  const startPuzzle = page.getByRole('button', { name: 'Begin Puzzle' });
  if (await startPuzzle.isVisible()) await startPuzzle.click();
  const skipGuide = page.getByRole('button', { name: 'Skip guide' });
  if (await skipGuide.isVisible()) await skipGuide.click();

  const account = page.getByRole('button', { name: /player menu for/i });
  await expect(account).toBeVisible();
  const accountBox = await boxOf(account);
  const viewport = page.viewportSize();
  expect(accountBox.right).toBeLessThanOrEqual(viewport?.width ?? Number.POSITIVE_INFINITY);

  await account.click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  await page.getByRole('radio', { name: /slate \/ tile/i }).click();
  await page.getByRole('checkbox', { name: /cell numbering/i }).uncheck();
  await page.getByRole('button', { name: '← Back' }).click();

  const pitch = page.locator('.pitch');
  const firstSquare = page.locator('.pitch__grid .square').first();
  await expect(pitch).toHaveClass(/pitch--surface-slate/);
  await expect(pitch).toHaveClass(/pitch--coordinates-hidden/);
  await expect(page.locator('.pitch__col-labels, .pitch__row-labels')).toHaveCount(0);

  const pitchBox = await boxOf(pitch);
  const squareBox = await boxOf(firstSquare);
  expect(pitchBox.width).toBeGreaterThan(100);
  expect(squareBox.width).toBeGreaterThan(5);
  expect(Math.abs(squareBox.width - squareBox.height)).toBeLessThan(1);
});
