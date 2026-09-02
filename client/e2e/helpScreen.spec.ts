import { expect, test } from '@playwright/test';
import { hasHorizontalOverflow, signInAsGuest, startGame } from './helpers';

async function openHelp(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /player menu for/i }).click();
  await page.getByRole('menuitem', { name: 'Help & rules' }).click();
  await expect(page.getByRole('heading', { name: 'Help & rules' })).toBeVisible();
}

test('Help & rules illustrates Parallel Universes without overflowing the phone', async ({ page }) => {
  await page.goto('/');
  await signInAsGuest(page, 'Help Screen Tester');
  await openHelp(page);

  await page.getByRole('tab', { name: 'Parallel Universes' }).click();

  const help = page.locator('.help-screen');
  await expect(help.getByRole('heading', { name: 'Parallel Universes' })).toBeVisible();
  await expect(help.getByRole('heading', { name: 'Branch strips' })).toBeVisible();
  await expect(help.getByRole('heading', { name: 'Lockstep' })).toBeVisible();
  await expect(help.getByRole('img', { name: /splitting one root play/i })).toBeVisible();
  await expect(help.getByRole('img', { name: /three universe cards/i })).toBeVisible();
  await expect(help.getByRole('img', { name: /same safe movement copied/i })).toBeVisible();
  await expect(help.getByText(/1\.1, 1\.2/).first()).toBeVisible();
  expect(await hasHorizontalOverflow(page)).toBe(false);
});

test('Help & rules returns to the active puzzle without losing its board', async ({ page }) => {
  await startGame(page, 'In-game Help Tester');
  const pitch = page.getByRole('group', { name: 'Pitch' });
  await expect(pitch).toBeVisible();

  await openHelp(page);
  await page.getByRole('button', { name: '← Back' }).click();

  await expect(pitch).toBeVisible();
  await expect(page.getByRole('button', { name: 'Game tools' })).toBeVisible();
});
