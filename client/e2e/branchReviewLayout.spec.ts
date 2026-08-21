import { test, expect } from '@playwright/test';

test('a long branch review keeps its action log reachable inside the viewport', async ({ page }) => {
  await page.goto('/');

  // Load the real application styles, then isolate the review geometry. The
  // component suite verifies that BranchRunSummary renders this exact wrapper;
  // this browser test verifies the layout behavior jsdom cannot measure.
  await page.evaluate(() => {
    const root = document.querySelector('#root');
    if (root instanceof HTMLElement) root.style.display = 'none';
    document.body.insertAdjacentHTML('beforeend', `
      <div id="branch-review-fixture" class="app app--game app--playbook">
        <div class="modal-backdrop">
          <div class="modal branch-summary branch-summary--detail">
            <button class="branch-summary__back">Back to summary</button>
            <h2 class="modal__title branch-summary__detail-title">Universe 1</h2>
            <div class="branch-summary__detail-scroll">
              <div style="height: 900px">Play diagrams</div>
              <div data-review-log>Action log</div>
            </div>
          </div>
        </div>
      </div>
    `);
  });

  const modal = page.locator('#branch-review-fixture .branch-summary--detail');
  const scrollArea = page.locator('#branch-review-fixture .branch-summary__detail-scroll');
  const heading = page.locator('#branch-review-fixture h2');
  const actionLog = page.locator('[data-review-log]');

  const geometry = await scrollArea.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    overflowY: getComputedStyle(element).overflowY,
  }));
  expect(geometry.scrollHeight).toBeGreaterThan(geometry.clientHeight);
  expect(geometry.overflowY).toBe('auto');

  const modalBox = await modal.boundingBox();
  expect(modalBox).not.toBeNull();
  expect(modalBox!.y).toBeGreaterThanOrEqual(0);
  expect(modalBox!.y + modalBox!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);

  await scrollArea.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(actionLog).toBeInViewport();
  await expect(heading).toBeInViewport();
});
