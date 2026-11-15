import { test, expect } from '@playwright/test';
import { boxOf, hasHorizontalOverflow, startScenario } from './helpers';

test.setTimeout(120_000);

test('block split can be revisited on pitch and switched by dice outcome', async ({ page }) => {
  await startScenario(page, 'Loose Ball on the Goal Line', 'Split Point Tester');

  // Make the real first block in this drill. The board state is shared with
  // blockDialog.spec.ts, so the marker location comes from actual game data.
  await page.locator('.square[data-square="7F"] .piece').click({ force: true });
  await page.locator('.piece-menu__item', { hasText: 'Block' }).locator('input').check({ force: true });
  await page.locator('.piece-menu__confirm').click({ force: true });
  // The target overlay can lag behind the menu closing in WebKit. Wait for
  // the actual rules-engine targeting state before attempting the block.
  await expect(page.locator('.square[data-square="6F"]')).toHaveClass(/square--block-target/);
  await page.locator('.square[data-square="6F"]').click({ force: true });
  await page.locator('.block-split').waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('.block-split').getByRole('button', { name: 'Progress' }).click({ force: true });

  const introContinue = page.getByRole('button', { name: 'Show the universe strip' });
  if (await introContinue.isVisible()) await introContinue.click();

  const trigger = page.locator('.pitch-split-point__trigger').first();
  await expect(trigger).toBeVisible();
  await trigger.click({ force: true });

  const popover = page.locator('.pitch-split-point__popover');
  await expect(popover).toBeVisible();
  const options = popover.locator('.pitch-split-point__choice');
  expect(await options.count()).toBeGreaterThan(1);
  await expect(popover.locator('.block-dice-graphic').first()).toBeVisible();

  const box = await boxOf(popover);
  const viewport = page.viewportSize()!;
  expect(box.left).toBeGreaterThanOrEqual(-1);
  expect(box.right).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.top).toBeGreaterThanOrEqual(-1);
  expect(box.bottom).toBeLessThanOrEqual(viewport.height + 1);

  const second = popover.locator('.pitch-split-point__choice').nth(1);
  await second.click({ force: true });
  await expect(popover).toHaveCount(0);

  // Reopen at the original block location: the chosen universe is now active.
  await trigger.click({ force: true });
  await expect(popover.locator('.pitch-split-point__choice').nth(1)).toHaveAttribute('aria-current', 'true');
  expect(await hasHorizontalOverflow(page)).toBe(false);
});
