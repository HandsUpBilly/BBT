import { test, expect } from '@playwright/test';
import { boxOf, hasHorizontalOverflow } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /play as guest/i }).click();
  await page.locator('.identity-gate__input').fill('Block Dialog Tester');
  await page.getByRole('button', { name: /^continue$/i }).click();

  await page.getByRole('button', { name: /player menu for/i }).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();
  await page.getByRole('checkbox', { name: /Block outcome branching/ }).check();
  await page.getByRole('button', { name: '← Back' }).click();

  await page.getByRole('tab', { name: /single plays/i }).click();
  await page.locator('.challenge-tile', { hasText: 'Loose Ball on the Goal Line' })
    .getByRole('button', { name: /^play$/i }).click();

  // The playbook continuously animates on mobile, so WebKit never considers
  // these otherwise-actionable controls geometrically stable.
  await page.locator('.square[data-square="7F"] .piece').click({ force: true });
  await page.locator('.piece-menu__item', { hasText: 'Block' }).locator('input').check({ force: true });
  await page.locator('.piece-menu__confirm').click({ force: true });
  await page.locator('.square[data-square="6F"]').click({ force: true });
  await page.locator('.block-split').waitFor({ state: 'visible' });
});

test('explains the dice and fits every supported viewport', async ({ page }) => {
  const dialog = page.locator('.block-split');
  await expect(dialog.getByText('Possible outcomes')).toBeVisible();
  await expect(dialog.getByText(/ST \d+ \+ \d+ assists? = \d+/).first()).toBeVisible();
  await expect(dialog.getByText(/\d dice? · (even strength|uphill|downhill)/)).toBeVisible();
  await expect(dialog.locator('.block-split__row--dead small')).not.toBeEmpty();
  await expect(dialog.getByRole('button', { name: 'Progress' })).toBeVisible();
  await expect(dialog.getByText(/pick/i)).toHaveCount(0);

  const dice = dialog.locator('.block-die-icon');
  const diceCount = await dice.count();
  expect(diceCount).toBeGreaterThan(0);
  await expect(dialog.locator('.block-die-icon__face')).toHaveCount(diceCount * 5);
  expect(await dice.first().evaluate(el => getComputedStyle(el).animationName))
    .toContain('block-die-tumble');

  for (let index = 0; index < diceCount; index += 1) {
    const die = await boxOf(dice.nth(index));
    expect(die.width, 'preview block die is deliberately prominent').toBeGreaterThanOrEqual(56);
  }

  const viewport = page.viewportSize()!;
  const bounds = await boxOf(dialog);
  expect(bounds.left).toBeGreaterThanOrEqual(-1);
  expect(bounds.right).toBeLessThanOrEqual(viewport.width + 1);
  expect(bounds.top).toBeGreaterThanOrEqual(-1);
  expect(bounds.bottom).toBeLessThanOrEqual(viewport.height + 1);
  expect(await hasHorizontalOverflow(page)).toBe(false);
});
