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
            <header class="branch-summary__detail-header">
              <button class="branch-summary__back"><span>←</span><span>Back to summary</span></button>
              <p class="branch-summary__detail-kicker">Universe review</p>
              <h2 class="modal__title branch-summary__detail-title">
                <span>Universe 1</span><span class="branch-summary__detail-outcome">Pushed</span>
              </h2>
              <p class="branch-summary__detail-path">Aldric Swiftfoot versus Grukk Ironjaw: Pushed</p>
            </header>
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
  const viewport = page.viewportSize()!;
  expect(modalBox).not.toBeNull();
  expect(modalBox!.y).toBeGreaterThanOrEqual(0);
  expect(modalBox!.y + modalBox!.height).toBeLessThanOrEqual(viewport.height + 1);
  const viewportGutter = viewport.width <= 480 ? 20 : 32;
  expect(modalBox!.width).toBeLessThanOrEqual(Math.min(1180, viewport.width - viewportGutter) + 1);
  if (viewport.width >= 1212) expect(modalBox!.width).toBeGreaterThanOrEqual(1179);

  await scrollArea.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(actionLog).toBeInViewport();
  await expect(heading).toBeInViewport();
});
