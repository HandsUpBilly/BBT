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
  expect(box.bottom, `${selector} ends below the viewport`).toBeLessThanOrEqual(viewport.height + 1);
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

test('opens a compact action box beside the player and reveals complete stats', async ({ page }) => {
  const playerSquare = page.locator('.square[data-square="7F"]');
  const playerBox = await boxOf(playerSquare);
  await playerSquare.locator('.piece').click({ force: true });
  const menu = page.locator('.piece-menu');
  await expect(menu).toBeVisible();
  const menuBox = await boxOf(menu);
  expect(menuBox.height, 'action selector should not consume most of the screen').toBeLessThanOrEqual(270);
  const isBesidePlayer = menuBox.right <= playerBox.left
    || menuBox.left >= playerBox.right
    || menuBox.bottom <= playerBox.top
    || menuBox.top >= playerBox.bottom;
  expect(isBesidePlayer, 'action selector overlaps the clicked player').toBe(true);
  const gap = Math.min(
    Math.abs(menuBox.right - playerBox.left),
    Math.abs(menuBox.left - playerBox.right),
    Math.abs(menuBox.bottom - playerBox.top),
    Math.abs(menuBox.top - playerBox.bottom),
  );
  expect(gap, 'action selector is not anchored beside the clicked player').toBeLessThanOrEqual(10);
  await expectInsideViewport(page, '.piece-menu');
  await expect(menu.getByLabel(/stats/)).toContainText('PA');
  await expect(menu.getByLabel(/stats/)).toContainText('AV');

  await menu.locator('.piece-menu__item', { hasText: 'Move' }).locator('input').check({ force: true });
  await menu.getByRole('button', { name: 'Confirm' }).click({ force: true });
  await expect(page.locator('.info-sheet')).toHaveClass(/info-sheet--open/);
  await expect(page.locator('.info-sheet__panel')).toBeVisible();
  await expect(page.locator('.info-sheet__panel .panel__stat-label')).toHaveText(['MA', 'ST', 'AG', 'PA', 'AV']);
});

test('keeps Parallel Universe selectors below the HUD and within the screen', async ({ page }) => {
  test.setTimeout(90_000);
  // Cedric has Block, so Both Down leaves a live "Down in place" universe.
  // Following up in the pushed universe then places Cedric on the square
  // where the alternate defender ghost remains — the overlap regression.
  await page.locator('.square[data-square="7G"] .piece').click({ force: true });
  await page.locator('.piece-menu__item', { hasText: 'Block' }).locator('input').check({ force: true });
  await page.locator('.piece-menu__confirm').click({ force: true });
  await page.locator('.square[data-square="6G"]').click({ force: true });

  const blockDice = page.getByRole('dialog').locator('.block-die-icon__face');
  await expect(blockDice.first()).toBeVisible();
  expect(await blockDice.first().evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(256);

  await page.getByRole('button', { name: 'Progress' }).click({ force: true });

  const strip = page.locator('.branch-strip');
  await expect(strip).toBeVisible();
  await strip.scrollIntoViewIfNeeded();
  await expectInsideViewport(page, '.branch-strip');
  await expect(page.locator('.hud .branch-strip')).toHaveCount(0);
  expect(await hasHorizontalOverflow(page)).toBe(false);

  const treeScroll = await strip.locator('.branch-tree-nav__scroll').evaluate(element => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(treeScroll.clientWidth).toBeGreaterThan(0);
  expect(treeScroll.scrollWidth).toBeGreaterThanOrEqual(treeScroll.clientWidth);

  const cardMetrics = await strip.locator('.branch-chip').evaluateAll(cards => cards.map(card => {
    const cardBox = card.getBoundingClientRect();
    const dice = card.querySelector('.branch-chip__dice')!.getBoundingClientRect();
    const weight = card.querySelector('.branch-chip__weight')!.getBoundingClientRect();
    const diceSizes = Array.from(card.querySelectorAll('.branch-chip__die'))
      .map(die => die.getBoundingClientRect().width);
    return {
      cardWidth: cardBox.width,
      diceWidth: dice.width,
      diceRight: dice.right,
      weightLeft: weight.left,
      diceSizes,
    };
  }));
  expect(cardMetrics.length).toBeGreaterThan(1);
  for (const metrics of cardMetrics) {
    expect(metrics.cardWidth, 'the outcome content must fill its available fixed-width track').toBeGreaterThanOrEqual(190);
    expect(metrics.cardWidth, 'controls and outcome content together must stay within one track').toBeLessThanOrEqual(328);
    expect(metrics.diceWidth, 'the dice tray should reserve room for three dice').toBeCloseTo(90, 0);
    expect(metrics.diceRight, 'dice should not overlap the probability').toBeLessThanOrEqual(metrics.weightLeft + 1);
    for (const dieSize of metrics.diceSizes) {
      expect(dieSize, 'resolved dice should stay the same size').toBeCloseTo(28, 0);
    }
  }

  const blockGroups = await strip.locator('.branch-strip-row__block').evaluateAll(groups => groups.map(group => {
    const header = group.querySelector('.branch-strip-row__block-group')!.getBoundingClientRect();
    const cards = Array.from(group.querySelectorAll('.branch-strip-state__actions'))
      .map(card => card.getBoundingClientRect());
    return {
      header: { left: header.left, right: header.right, width: header.width },
      cards: cards.map(card => ({ left: card.left, right: card.right, width: card.width })),
    };
  }));
  for (const group of blockGroups) {
    expect(group.cards.length).toBeGreaterThan(0);
    expect(group.header.left, 'the Block header starts with its first outcome').toBeCloseTo(group.cards[0].left, 0);
    expect(group.header.right, 'the Block header ends with its last outcome').toBeCloseTo(group.cards.at(-1)!.right, 0);
    for (const card of group.cards) {
      expect(card.width, 'each outcome and its controls fill one fixed track').toBeCloseTo(328, 0);
    }
    for (let index = 1; index < group.cards.length; index += 1) {
      expect(
        group.cards[index].left - group.cards[index - 1].right,
        'sibling outcome tracks keep only the compact gutter',
      ).toBeCloseTo(6, 0);
    }
  }

  await page.locator('.square--push-target').first().click({ force: true });
  await page.getByRole('button', { name: 'Follow Up' }).click({ force: true });

  const ghost = page.locator('.piece--branch-ghost').first();
  await expect(ghost).toBeVisible();
  expect(await ghost.evaluate(element => getComputedStyle(element).position),
    'branch ghosts must overlay other square contents instead of joining the flex row').toBe('absolute');

  const squareBox = await boxOf(ghost.locator('..'));
  const ghostBox = await boxOf(ghost);
  expect(ghostBox.width, 'the ghost token should keep its full width').toBeCloseTo(squareBox.width * 0.88, 0);
  expect(ghostBox.left, 'the ghost should remain centred in its square')
    .toBeCloseTo(squareBox.left + squareBox.width * 0.06, 0);
  expect(ghostBox.top, 'the ghost should remain centred in its square')
    .toBeCloseTo(squareBox.top + squareBox.height * 0.06, 0);
});
