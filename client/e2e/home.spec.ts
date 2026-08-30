import { test, expect } from '@playwright/test';
import { boxOf, hasHorizontalOverflow } from './helpers';

async function footerPlacement(page: import('@playwright/test').Page) {
  return page.locator('.app-footer').evaluate((footer) => {
    const rect = footer.getBoundingClientRect();
    const pageBottom = Math.max(document.documentElement.scrollHeight, document.documentElement.clientHeight);
    return {
      bottom: rect.bottom + window.scrollY,
      pageBottom,
      viewportHeight: document.documentElement.clientHeight,
    };
  });
}

function expectFooterAtPageBottom(footer: Awaited<ReturnType<typeof footerPlacement>>) {
  // Non-landing shells retain up to 10px of safe outer padding below the
  // footer; touch landing shells retain 6px.
  expect(footer.bottom, 'footer must not float above the viewport bottom')
    .toBeGreaterThanOrEqual(footer.viewportHeight - 12);
  expect(Math.abs(footer.pageBottom - footer.bottom), 'gap below footer').toBeLessThanOrEqual(12);
}

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

  test('the footer stays at the bottom of the page', async ({ page }) => {
    expectFooterAtPageBottom(await footerPlacement(page));
  });

  test('the wide hero preserves the artwork proportions', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1100, 'wide-screen composition only');

    const header = await boxOf(page.locator('.scenario-select__header'));
    const ratio = header.width / header.height;

    expect(ratio, 'hero should show the full-height character composition').toBeGreaterThan(2.1);
    expect(ratio, 'hero should not crop back to the former shallow banner').toBeLessThan(2.22);
  });

  test('the archive footer stays at the bottom of the page', async ({ page }) => {
    await page.getByRole('button', { name: 'Rankings' }).click();
    await page.locator('.leaderboard').waitFor({ state: 'visible' });

    expectFooterAtPageBottom(await footerPlacement(page));
  });
});

test('the signed-out footer stays at the bottom of the page', async ({ page }) => {
  await page.goto('/');
  expectFooterAtPageBottom(await footerPlacement(page));
});
