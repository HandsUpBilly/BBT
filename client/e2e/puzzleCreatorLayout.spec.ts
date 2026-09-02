import { test, expect, type Page } from '@playwright/test';
import { boxOf, hasHorizontalOverflow, signInAsGuest } from './helpers';

async function openPuzzleCreator(page: Page) {
  await page.goto('/');
  await signInAsGuest(page, 'Creator Layout QA');
  await page.getByRole('button', { name: 'Admin' }).click();
  await page.locator('.editor__layout').waitFor({ state: 'visible' });
}

test.describe('Puzzle Creator workbench', () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      !['iphone-se', 'ipad-mini', 'desktop'].includes(testInfo.project.name),
      'The creator workbench is covered at phone, tablet, and desktop widths.',
    );
    await openPuzzleCreator(page);
  });

  test('keeps the library, board, and tools in a deliberate responsive order', async ({ page }) => {
    const library = await boxOf(page.locator('.editor__panel--list'));
    const board = await boxOf(page.locator('.editor__pitch-panel'));
    const tools = await boxOf(page.locator('.editor__panel--inspector'));
    const width = page.viewportSize()?.width ?? 0;

    if (width > 1100) {
      expect(library.right).toBeLessThanOrEqual(board.left);
      expect(board.right).toBeLessThanOrEqual(tools.left);
      expect(Math.abs(library.top - board.top)).toBeLessThanOrEqual(2);
      expect(Math.abs(board.top - tools.top)).toBeLessThanOrEqual(2);
    } else if (width > 760) {
      expect(library.right).toBeLessThanOrEqual(board.left);
      expect(tools.top).toBeGreaterThanOrEqual(Math.min(library.bottom, board.bottom));
    } else {
      expect(board.top).toBeGreaterThanOrEqual(library.bottom);
      expect(tools.top).toBeGreaterThanOrEqual(board.bottom);
    }

    expect(await hasHorizontalOverflow(page)).toBe(false);

    const playerTab = page.getByRole('tab', { name: 'Player', exact: true });
    await playerTab.scrollIntoViewIfNeeded();
    await playerTab.click({ force: true });
    await expect(page.getByRole('heading', { name: 'Selected Player' })).toBeVisible();

    await page.getByRole('tab', { name: 'Series', exact: true }).click({ force: true });
    await expect(page.getByLabel('Series name')).toBeVisible();

    await page.getByRole('tab', { name: /^Review/ }).click({ force: true });
    await expect(page.getByRole('heading', { name: 'Review Draft' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Discard Unsaved Changes' })).toBeVisible();

    await page.getByRole('tab', { name: 'Roster', exact: true }).click({ force: true });
    await expect(page.getByRole('heading', { name: 'Player Roster' })).toBeVisible();
  });
});
