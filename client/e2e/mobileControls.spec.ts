import { expect, test } from '@playwright/test';
import { boxOf, hasHorizontalOverflow, isCompact, startScenario } from './helpers';

test.beforeEach(async ({ page }) => {
  test.skip(!(await isCompact(page)), 'mobile control surface applies to compact layouts');
  await startScenario(page, 'Loose Ball on the Goal Line', 'Mobile Controls Tester');
});

async function expectInsideViewport(page: import('@playwright/test').Page, selector: string) {
  const viewport = page.viewportSize()!;
  const box = await boxOf(page.locator(selector));
  expect(box.left, `${selector} starts outside the viewport`).toBeGreaterThanOrEqual(-1);
  expect(box.right, `${selector} ends outside the viewport`).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.top, `${selector} starts above the viewport`).toBeGreaterThanOrEqual(-1);
}

test('resets home-page scroll and keeps every HUD control on screen', async ({ page }) => {
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expectInsideViewport(page, '.hud');

  const viewport = page.viewportSize()!;
  const controls = await page.locator('.hud button').evaluateAll(buttons => buttons.map(button => {
    const box = button.getBoundingClientRect();
    return { name: button.getAttribute('aria-label'), left: box.left, right: box.right };
  }));
  for (const control of controls) {
    expect(control.left, `${control.name} starts off-screen`).toBeGreaterThanOrEqual(-1);
    expect(control.right, `${control.name} ends off-screen`).toBeLessThanOrEqual(viewport.width + 1);
  }
});

test('anchors every toolbar panel to the phone viewport', async ({ page }) => {
  await page.getByRole('button', { name: /Player menu for/ }).click();
  await expectInsideViewport(page, '.user-menu__dropdown');
  await page.getByRole('button', { name: /Player menu for/ }).click();

  await page.getByRole('button', { name: 'Game tools' }).click();
  await expectInsideViewport(page, '.game-tools-menu__dropdown');
  await page.getByRole('button', { name: 'Game tools' }).click();

  await page.getByRole('button', { name: 'Key' }).click();
  await expectInsideViewport(page, '.legend-menu__dropdown');
  await page.getByRole('button', { name: 'Key' }).click();

  await page.getByRole('button', { name: 'Action log' }).click();
  await expectInsideViewport(page, '.action-log-menu__dropdown');
});

test('uses a compact action sheet and reveals complete player stats', async ({ page }) => {
  await page.locator('.square[data-square="7F"] .piece').click({ force: true });
  const menu = page.locator('.piece-menu');
  await expect(menu).toBeVisible();
  const menuBox = await boxOf(menu);
  expect(menuBox.height, 'action selector should not consume most of the screen').toBeLessThanOrEqual(210);
  await expect(menu.getByLabel(/stats/)).toContainText('PA');
  await expect(menu.getByLabel(/stats/)).toContainText('AV');

  await menu.locator('.piece-menu__item', { hasText: 'Move' }).locator('input').check({ force: true });
  await menu.getByRole('button', { name: 'Confirm' }).click({ force: true });
  await expect(page.locator('.info-sheet')).toHaveClass(/info-sheet--open/);
  await expect(page.locator('.info-sheet__panel')).toBeVisible();
  await expect(page.locator('.info-sheet__panel .panel__stat-label')).toHaveText(['MA', 'ST', 'AG', 'PA', 'AV']);
});

test('keeps Parallel Universe selectors below the HUD and within the screen', async ({ page }) => {
  await page.locator('.square[data-square="7F"] .piece').click({ force: true });
  await page.locator('.piece-menu__item', { hasText: 'Block' }).locator('input').check({ force: true });
  await page.locator('.piece-menu__confirm').click({ force: true });
  await page.locator('.square[data-square="6F"]').click({ force: true });
  await page.getByRole('button', { name: 'Progress' }).click({ force: true });

  const strip = page.locator('.branch-strip');
  await expect(strip).toBeVisible();
  await expectInsideViewport(page, '.branch-strip');
  await expect(page.locator('.hud .branch-strip')).toHaveCount(0);
  expect(await hasHorizontalOverflow(page)).toBe(false);

  const list = await strip.locator('.branch-strip__list').evaluate(element => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(list.clientWidth).toBeGreaterThan(0);
  expect(list.scrollWidth).toBeGreaterThanOrEqual(list.clientWidth);
});
