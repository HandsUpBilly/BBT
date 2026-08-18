import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Scenario } from '../src/types';
import { hasHorizontalOverflow } from './helpers';

const scenario = JSON.parse(
  readFileSync(new URL('../src/scenarios/scenario-006.json', import.meta.url), 'utf8'),
) as Scenario;

test('the Parallel Universes briefing shows its decision tree without breaking the dialog', async ({ page }) => {
  await page.route('**/api/scenarios', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      scenarios: [scenario],
      series: {
        id: 'default',
        name: 'Tutorial',
        description: 'One drill introducing Blocking and Parallel Universes.',
        scenarioIds: [scenario.id],
      },
    }),
  }));

  await page.goto('/');
  await page.getByRole('button', { name: /play as guest/i }).click();
  await page.locator('.identity-gate__input').fill('Tutorial Art Tester');
  await page.getByRole('button', { name: /^continue$/i }).click();
  await expect(page.getByText('One drill introducing Blocking and Parallel Universes.')).toBeVisible();
  await page.getByRole('button', { name: /start series/i }).click();

  const dialog = page.getByRole('dialog', { name: 'Blocking and Parallel Universes' });
  const artwork = dialog.getByRole('img', { name: /decision tree splitting one block/i });
  await expect(dialog).toBeVisible();
  await expect(artwork).toBeVisible();
  expect(await artwork.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);

  const dialogBox = await dialog.boundingBox();
  const artworkBox = await artwork.boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(artworkBox).not.toBeNull();
  expect(artworkBox!.x).toBeGreaterThanOrEqual(dialogBox!.x);
  expect(artworkBox!.x + artworkBox!.width).toBeLessThanOrEqual(dialogBox!.x + dialogBox!.width);
  expect(dialogBox!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  expect(await hasHorizontalOverflow(page)).toBe(false);

  const beginButton = dialog.getByRole('button', { name: 'Begin Puzzle' });
  await beginButton.scrollIntoViewIfNeeded();
  await expect(beginButton).toBeVisible();
});
