import { expect, test } from '@playwright/test';
import { hasHorizontalOverflow } from './helpers';

async function startFirstGuidedAttempt(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /play as guest/i }).click();
  await page.locator('.identity-gate__input').fill('Tutorial Coach Tester');
  await page.getByRole('button', { name: /^continue$/i }).click();
  await page.getByRole('button', { name: /start series/i }).click();
  await expect(page.getByRole('heading', { name: 'Movement' })).toBeVisible();
  await page.getByRole('button', { name: 'Begin Puzzle' }).click();
}

test('guided attempt reveals help gradually and advances after the correct interaction', async ({ page }, testInfo) => {
  test.skip(!['iphone-se', 'desktop'].includes(testInfo.project.name), 'Representative phone and desktop coverage');
  await startFirstGuidedAttempt(page);

  const dialog = page.getByRole('dialog', { name: 'Start with the ball carrier' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Movement: Step 1 of 4')).toBeVisible();
  await expect(dialog.getByText('Coach prompt')).toBeVisible();
  await expect(dialog.getByRole('img', { name: /opening formation with the ball carrier/i })).toBeVisible();
  expect(await hasHorizontalOverflow(page)).toBe(false);

  await dialog.getByRole('button', { name: 'More help' }).click();
  await expect(dialog.getByText('Directed hint')).toBeVisible();
  await expect(dialog.getByText(/Aldric Swiftfoot already has the ball/i)).toBeVisible();
  await dialog.getByRole('button', { name: 'Try it' }).click();

  await page.getByRole('button', { name: /Aldric Swiftfoot.*carrying the ball/i }).click();
  const actionStep = page.getByRole('dialog', { name: 'Choose the action' });
  await expect(actionStep.getByText('Movement: Step 2 of 4')).toBeVisible();
  await expect(actionStep.getByRole('img', { name: /player action menu/i })).toBeVisible();
  await actionStep.getByRole('button', { name: 'Try it' }).click();
  await page.getByRole('checkbox', { name: 'Move' }).check();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByRole('dialog', { name: 'Plot the route' })).toBeVisible();
});

test('guide actions remain reachable in a narrow, magnified viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone-se', 'Narrow phone coverage');
  await page.setViewportSize({ width: 320, height: 568 });
  await startFirstGuidedAttempt(page);
  // Browser zoom is not exposed consistently through Playwright. Doubling the
  // root font size exercises the same text reflow and internal-dialog scroll
  // constraints without CSS `zoom`, whose fixed-position geometry is unlike
  // native browser zoom.
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });

  const dialog = page.getByRole('dialog', { name: 'Start with the ball carrier' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Try it' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Try it' }).scrollIntoViewIfNeeded();
  await expect(dialog.getByRole('button', { name: 'Try it' })).toBeInViewport();
  expect(await hasHorizontalOverflow(page)).toBe(false);
});

test('skip is attempt-local, Game Tools reopens the stage, and Restart replays guidance', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone-se', 'Compact Game Tools coverage');
  await startFirstGuidedAttempt(page);

  await page.getByRole('button', { name: 'Skip guide' }).click();
  await expect(page.getByRole('dialog', { name: 'Start with the ball carrier' })).toBeHidden();

  await page.getByRole('button', { name: 'Game tools' }).click();
  await page.getByRole('menuitem', { name: 'Tutorial guide' }).click();
  await expect(page.getByRole('dialog', { name: 'Start with the ball carrier' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip guide' }).click();

  await page.getByRole('button', { name: 'Game tools' }).click();
  await page.getByRole('menuitem', { name: 'Restart turn' }).click();
  await expect(page.getByRole('heading', { name: 'Movement' })).toBeVisible();
  await page.getByRole('button', { name: 'Begin Puzzle' }).click();
  await expect(page.getByRole('dialog', { name: 'Start with the ball carrier' })).toBeVisible();
});
