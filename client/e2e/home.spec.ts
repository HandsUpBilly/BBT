import { test, expect } from '@playwright/test';
import { boxOf, hasHorizontalOverflow, signInAsGuest } from './helpers';

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
    await signInAsGuest(page, 'E2E Tester');
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

  test('the footer gives the wordmark its own brand zone', async ({ page }) => {
    const brand = await boxOf(page.locator('.app-footer__brand'));
    const logo = await boxOf(page.locator('.app-footer__logo'));
    const legal = await boxOf(page.locator('.app-footer__legal'));
    const viewportWidth = page.viewportSize()?.width ?? 0;

    expect(logo.width, 'footer wordmark width').toBeGreaterThanOrEqual(84);
    if (viewportWidth > 760) {
      expect(brand.right, 'brand zone ends before legal copy')
        .toBeLessThanOrEqual(legal.left + 1);
    } else {
      expect(brand.bottom, 'brand zone sits above legal copy')
        .toBeLessThanOrEqual(legal.top + 1);
    }
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test('free play filters stay usable without widening the page', async ({ page }) => {
    await page.getByRole('tab', { name: 'Free Play' }).click();

    await expect(page.getByText('These matches can be played individually.')).toBeVisible();
    await expect(page.getByText('From the tutorial', { exact: true })).toBeVisible();
    await expect(page.getByText('The final puzzle from the tutorial, with every action available.')).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);

    await page.getByRole('button', { name: 'Specials' }).click();
    await expect(page.getByText('No special matches are available yet.')).toBeVisible();
    await expect(page.locator('.challenge-tile')).toHaveCount(0);

    await page.getByRole('button', { name: 'All matches' }).click();
    await expect(page.locator('.challenge-tile')).toHaveCount(1);
  });

  test('the wide hero preserves the artwork proportions', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1100, 'wide-screen composition only');

    const header = await boxOf(page.locator('.scenario-select__header'));
    const ratio = header.width / header.height;

    expect(ratio, 'hero should show the full-height character composition').toBeGreaterThan(2.1);
    expect(ratio, 'hero should not crop back to the former shallow banner').toBeLessThan(2.22);
  });

  test('the hero overlay does not draw an artificial centre seam', async ({ page }) => {
    const overlayBackground = await page.locator('.scenario-select__header').evaluate((header) => (
      getComputedStyle(header, '::before').backgroundImage
    ));

    expect(overlayBackground).toContain('radial-gradient');
    expect(overlayBackground).not.toContain('linear-gradient');
  });

  test('the archive footer stays at the bottom of the page', async ({ page }) => {
    await page.getByRole('button', { name: 'Rankings' }).click();
    await page.locator('.leaderboard').waitFor({ state: 'visible' });

    expectFooterAtPageBottom(await footerPlacement(page));
  });
});

test('@smoke the signed-out footer stays at the bottom of the page', async ({ page }) => {
  await page.goto('/');
  expectFooterAtPageBottom(await footerPlacement(page));
});

test('@smoke the guest alias form gives the name field useful writing room', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^log in$/i }).click();
  await page.getByRole('button', { name: /play as guest/i }).click();

  const panel = await boxOf(page.locator('.identity-login__dialog'));
  const input = await boxOf(page.locator('.identity-login__input'));
  const viewportWidth = page.viewportSize()?.width ?? 0;

  if (viewportWidth > 560) {
    expect(panel.width, 'alias dialog width').toBeGreaterThanOrEqual(400);
    expect(input.width, 'desktop alias input width').toBeGreaterThanOrEqual(330);
  } else {
    expect(input.width, 'mobile alias input width').toBeGreaterThanOrEqual(panel.width - 40);
  }
  expect(await hasHorizontalOverflow(page)).toBe(false);
});

test('the signed-out screen uses one launcher and equal-width login choices', async ({ page }) => {
  await page.route('**/api/auth/config', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ google: true, discord: true, email: true }),
  }));
  await page.goto('/');
  await expect(page.getByRole('button', { name: /^log in$/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /play as guest/i })).toBeHidden();

  await page.getByRole('button', { name: /^log in$/i }).click();
  const google = await boxOf(page.locator('.identity-login__google-button'));
  const discord = await boxOf(page.getByRole('button', { name: 'Log in with Discord' }));
  const email = await boxOf(page.getByRole('button', { name: 'Log in with email' }));
  expect(Math.abs(google.width - discord.width), 'Google and Discord widths').toBeLessThanOrEqual(1);
  expect(Math.abs(discord.width - email.width), 'Discord and email widths').toBeLessThanOrEqual(1);
  expect(Math.abs(google.height - discord.height), 'Google and Discord heights').toBeLessThanOrEqual(1);
  expect(await page.locator('.identity-login__google-button').evaluate(element => {
    const style = getComputedStyle(element);
    return { backgroundColor: style.backgroundColor, borderWidth: style.borderWidth };
  })).toEqual({ backgroundColor: 'rgba(0, 0, 0, 0)', borderWidth: '0px' });
  expect(await hasHorizontalOverflow(page)).toBe(false);
});
