import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright-core');
const baseUrl = process.env.PANTRY_UI_URL || 'http://localhost:4173';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const pass = (message) => console.log(`PASS ${message}`);
try {
  await context.route('**/config.js', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: 'window.PANTRY_CONFIG = {};' })
  );
  await page.goto(baseUrl);
  const exportButton = page.getByRole('button', { name: 'Export pantry data', exact: true });
  assert.equal(await exportButton.count(), 1);
  assert.equal(await exportButton.getAttribute('title'), 'Export pantry data');
  assert.equal(await exportButton.locator('svg', {}).count(), 1);
  pass('compact export icon has an accessible name, tooltip and SVG');
  const profileButton = page.getByRole('button', { name: 'Profile', exact: true });
  assert.equal(await page.locator('.notice').count(), 0);
  await profileButton.focus();
  await profileButton.press('Enter');
  const profileMenu = page.getByRole('menu', { name: 'Profile' });
  await profileMenu.waitFor();
  assert.match(
    await page.getByRole('status', { name: 'Connection status' }).innerText(),
    /Local demo/
  );
  assert.equal(
    await profileMenu.getByRole('menuitem', { name: 'Connect', exact: true }).count(),
    1
  );
  await profileMenu.getByRole('menuitem', { name: 'Connect', exact: true }).press('Escape');
  await profileMenu.waitFor({ state: 'hidden' });
  assert.equal(
    await page.evaluate(() => document.activeElement?.getAttribute('aria-label')),
    'Profile'
  );
  pass('profile menu reports signed-out state and supports keyboard open/close with focus return');
  const [exported] = await Promise.all([page.waitForEvent('download'), exportButton.click()]);
  assert.match(exported.suggestedFilename(), /^pantry-\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(await exported.failure(), null);
  pass('export icon still downloads pantry JSON');
  await page.getByRole('button', { name: 'Try sample pantry' }).click();
  await page.getByRole('heading', { name: 'Avocados', exact: true }).waitFor();
  assert.equal(await page.locator('.card').count(), 5);
  pass('sample pantry and category groups render');
  const glanceCounts = await page.locator('.glance-counts').innerText();
  assert.match(glanceCounts, /0\s+out/);
  assert.match(glanceCounts, /2\s+running low/);
  assert.equal(await page.locator('.card .food-art').count(), 5);
  assert.equal(await page.locator('.card .food-art svg').count(), 5);
  assert.equal(await page.locator('.hero-art svg').count(), 1);
  assert.match(await page.locator('.hero h1').evaluate((node) => getComputedStyle(node).fontFamily), /Fraunces/);
  assert.match(await page.locator('body').evaluate((node) => getComputedStyle(node).fontFamily), /Manrope/);
  assert.equal(await page.evaluate(() => document.fonts.check('600 38px Fraunces')), true);
  assert.equal(await page.evaluate(() => document.fonts.check('400 14px Manrope')), true);
  pass('glance derives 0 out and 2 low; five inline SVG foods, editorial hero art, and both self-hosted fonts render');
  const initialAvocados = page.locator('.shelf-card').filter({ has: page.getByRole('heading', { name: 'Avocados', exact: true }) });
  assert.equal(await initialAvocados.locator('.amount-update').count(), 1);
  assert.equal(await initialAvocados.locator('.batch, .batch-details').count(), 0);
  assert.equal(await initialAvocados.getByRole('button', { name: 'Update stock for Avocados' }).count(), 1);
  assert.match(await initialAvocados.locator('.stock-line').innerText(), /Pantry/);
  assert.doesNotMatch(await initialAvocados.innerText(), /Checked/);
  const blueberriesCard = page.locator('.shelf-card').filter({ has: page.getByRole('heading', { name: 'Blueberries', exact: true }) });
  assert.match(await blueberriesCard.locator('.expiry-status').innerText(), /Due/);
  pass('single-batch cards show quantity once as the stock-update button, compact location, and expiry without check dates');
  await page.getByLabel('Storage location').selectOption('Fridge');
  await page.getByLabel('Food category').selectOption('Fruit');
  await page.getByLabel('Search food').fill('blue');
  await page.getByRole('button', { name: 'See all 2 items' }).click();
  assert.equal(await page.getByLabel('Storage location').inputValue(), 'all');
  assert.equal(await page.getByLabel('Food category').inputValue(), 'all');
  assert.equal(await page.getByLabel('Search food').inputValue(), '');
  assert.equal(await page.locator('.stat[data-filter="low"]').getAttribute('class'), 'stat active');
  assert.equal(await page.locator('.shelf-card').count(), 2);
  await page.locator('.toolbar button[data-filter="all"]').click();
  pass('shopping glance reveals every low/out item after resetting location, category and search');
  const filters = await page.evaluate(() =>
    Object.fromEntries(
      ['#search', '#location', '#category', '#sort'].map((sel) => {
        const e = document.querySelector(sel),
          r = e.getBoundingClientRect();
        return [
          sel,
          {
            display: getComputedStyle(e.parentElement).display,
            x: r.x,
            width: r.width,
            height: r.height
          }
        ];
      })
    )
  );
  assert.equal(filters['#search'].display, 'grid');
  assert.ok(filters['#location'].width > 120 && filters['#category'].width > 120);
  assert.ok(Math.abs(filters['#location'].width - filters['#category'].width) < 3);
  assert.ok(filters['#sort'].width >= filters['#location'].width * 1.8);
  pass(
    '390px filters use clear full-width search and sort with balanced location/category controls'
  );
  const avocadoCard = page
      .locator('.card')
      .filter({ has: page.getByRole('heading', { name: 'Avocados', exact: true }) }),
    cardActions = avocadoCard.locator('.card-foot button');
  assert.equal(await cardActions.count(), 2);
  assert.deepEqual(
    await cardActions.evaluateAll((es) => es.map((e) => e.getAttribute('aria-label'))),
    [
      'Manage Avocados',
      'Add Avocados to shopping list'
    ]
  );
  assert.deepEqual(
    await cardActions.evaluateAll((es) =>
      es.map((e) => e.querySelector('svg')?.getAttribute('aria-hidden'))
    ),
    ['true', 'true']
  );
  assert.equal(
    await cardActions.evaluateAll((es) =>
      es.every(
        (e) =>
          e.title && e.getBoundingClientRect().width >= 44 && e.getBoundingClientRect().height >= 44
      )
    ),
    true
  );
  pass('food card actions use labeled SVG icons with tooltips and 44px touch targets');
  await avocadoCard.getByRole('button', { name: 'Manage Avocados' }).click();
  await page.getByRole('heading', { name: 'Manage Avocados' }).waitFor();
  assert.equal(await page.locator('#manage-details').count(), 1);
  assert.equal(await page.locator('#manage-stock').count(), 1);
  assert.equal(await page.getByRole('tab').count(), 2);
  assert.equal(await page.getByRole('tab', { name: 'Stock' }).getAttribute('aria-selected'), 'true');
  const manageMobile = await page.locator('dialog[open]').evaluate((dialog) => ({
    width: dialog.getBoundingClientRect().width,
    scrollWidth: dialog.scrollWidth,
    clientWidth: dialog.clientWidth,
    footerTargets: [...dialog.querySelectorAll('.manage-footer button')].map((button) => button.getBoundingClientRect().height)
  }));
  assert.ok(manageMobile.width <= 382 && manageMobile.scrollWidth <= manageMobile.clientWidth);
  assert.equal(manageMobile.footerTargets.length, 2);
  assert.ok(manageMobile.footerTargets.every((height) => height >= 44));
  for (const [width, height] of [[320, 640], [430, 760]]) {
    await page.setViewportSize({ width, height });
    const layout = await page.locator('dialog[open]').evaluate((dialog) => ({
      width: dialog.getBoundingClientRect().width,
      scrollWidth: dialog.scrollWidth,
      clientWidth: dialog.clientWidth
    }));
    assert.ok(layout.width <= width && layout.scrollWidth <= layout.clientWidth);
  }
  await page.setViewportSize({ width: 320, height: 480 });
  await page.locator('.manage-add-stock > summary').click();
  const shortSheet = await page.locator('dialog[open]').evaluate((dialog) => {
    const body = dialog.querySelector('.manage-body');
    const footer = dialog.querySelector('.manage-footer').getBoundingClientRect();
    const bounds = dialog.getBoundingClientRect();
    return { overflow: body.scrollHeight > body.clientHeight, footerBottom: footer.bottom, dialogBottom: bounds.bottom, width: dialog.scrollWidth <= dialog.clientWidth };
  });
  assert.equal(shortSheet.overflow, true);
  assert.ok(shortSheet.footerBottom <= shortSheet.dialogBottom && shortSheet.width);
  await page.locator('.manage-add-stock > summary').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('tab', { name: 'Stock' }).press('ArrowRight');
  assert.equal(await page.getByRole('tab', { name: 'Details' }).getAttribute('aria-selected'), 'true');
  await page.getByRole('tab', { name: 'Details' }).press('ArrowLeft');
  assert.equal(await page.getByRole('tab', { name: 'Stock' }).getAttribute('aria-selected'), 'true');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  pass('Manage tabs and compact footer fit at 320/390/430px and keep actions visible while the short sheet body scrolls');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  pass('390px layout has no horizontal overflow');
  await page.getByLabel('Food category').selectOption('Fruit');
  assert.equal(await page.locator('.card').count(), 2);
  await page.getByLabel('Search food').fill('blue');
  assert.equal(await page.locator('.card').count(), 1);
  pass('category filter composes with search');
  await page.getByLabel('Search food').fill('');
  await page.getByLabel('Food category').selectOption('all');
  let card = page
    .locator('.card')
    .filter({ has: page.getByRole('heading', { name: 'Avocados', exact: true }) });
  await card.getByRole('button', { name: 'Update stock for Avocados' }).click();
  await page.getByRole('heading', { name: 'Manage Avocados' }).waitFor();
  assert.equal(await page.locator('#manage-stock').count(), 1);
  await page.locator('input[name^="quantity-"]').fill('0');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.locator('#editor').waitFor({ state: 'hidden' });
  assert.match(await card.innerText(), /\bOut\b/);
  const outSummary = (await page.locator('.glance-counts').innerText()).replace(/\s+/g, ' ');
  assert.match(outSummary, /1 out/);
  assert.match(outSummary, /1 running low/);
  pass('check-in sets remaining quantity; out-of-stock food stays visible');
  await page.reload();
  card = page
    .locator('.card')
    .filter({ has: page.getByRole('heading', { name: 'Avocados', exact: true }) });
  await card.waitFor();
  assert.match(await card.innerText(), /\bOut\b/);
  pass('stock persists across reload');
  await card.getByRole('button', { name: 'Add Avocados to shopping list' }).click();
  await page.getByRole('button', { name: /Shopping list/ }).click();
  let row = page
    .locator('.shopping-row')
    .filter({ has: page.getByRole('heading', { name: 'Avocados', exact: true }) });
  await row.getByRole('button', { name: 'Restock', exact: true }).click();
  await page.locator('input[name="quantity"]').fill('4');
  await page.getByRole('button', { name: 'Add to pantry', exact: true }).click();
  await page.locator('#editor').waitFor({ state: 'hidden' });
  assert.equal(
    await page
      .locator('.shopping-row')
      .filter({ has: page.getByRole('heading', { name: 'Avocados', exact: true }) })
      .count(),
    0
  );
  pass('restock completes shopping item');
  await page.getByRole('button', { name: 'My inventory' }).click();
  card = page
    .locator('.card')
    .filter({ has: page.getByRole('heading', { name: 'Avocados', exact: true }) });
  assert.match(await card.locator('.amount').innerText(), /4 items/);
  pass('restock adds quantity once');
  await card.getByRole('button', { name: 'Manage Avocados' }).click();
  await page.getByRole('tab', { name: 'Details' }).click();
  const settingsCategory = page.locator('select[name="category-choice"]');
  assert.equal(await settingsCategory.evaluate((e) => e.tagName), 'SELECT');
  await settingsCategory.selectOption('new');
  await page.locator('[name="category-custom"]').fill('Breakfast');
  await page.getByRole('tab', { name: 'Stock' }).click();
  await page.locator('.manage-add-stock > summary').click();
  await page.locator('input[name="restock-quantity"]').fill('1');
  await page.getByRole('tab', { name: 'Details' }).click();
  assert.equal(await page.locator('[name="category-custom"]').inputValue(), 'Breakfast');
  assert.equal(await page.locator('input[name="restock-quantity"]').inputValue(), '1');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.locator('#editor').waitFor({ state: 'hidden' });
  assert.match(await card.locator('.amount').innerText(), /5 items/);
  pass('one Save changes action applies pending restock and preserves custom category edits through tab switches');
  await page.getByLabel('Food category').selectOption('Breakfast');
  assert.equal(await page.locator('.card').count(), 1);
  pass('custom category reassignment');
  await page.getByRole('button', { name: 'Add food', exact: false }).click();
  const addDialog = page.locator('dialog[open]');
  assert.equal(
    await addDialog.locator('select[name="category-choice"]').evaluate((e) => e.tagName),
    'SELECT'
  );
  const mobileModal = await addDialog.evaluate((dialog) => ({
    width: dialog.getBoundingClientRect().width,
    scrollWidth: dialog.scrollWidth,
    clientWidth: dialog.clientWidth,
    categoryWidth: dialog.querySelector('[name="category-choice"]').getBoundingClientRect().width
  }));
  assert.ok(mobileModal.width <= 370 && mobileModal.scrollWidth <= mobileModal.clientWidth);
  assert.ok(mobileModal.categoryWidth > 250);
  pass('Add modal category picker is native and usable at 390px');
  await page.locator('[name="name"]').fill('Rice');
  await page.locator('[name="quantity"]').selectOption('0.5');
  await addDialog.locator('select[name="category-choice"]').selectOption('new');
  assert.equal(await addDialog.locator('[name="category-custom"]').inputValue(), '');
  await addDialog.locator('[name="category-custom"]').fill('   ');
  await page.getByRole('button', { name: 'Add food', exact: true }).click();
  assert.equal(await addDialog.isVisible(), true);
  assert.equal(await addDialog.getByRole('alert').innerText(), 'Enter a category name.');
  await addDialog.locator('select[name="category-choice"]').selectOption({ label: 'Other' });
  await page.getByRole('button', { name: 'Add food', exact: true }).click();
  await page.locator('#editor').waitFor({ state: 'hidden' });
  await page.getByLabel('Food category').selectOption('all');
  assert.match(
    await page
      .locator('.card')
      .filter({ has: page.getByRole('heading', { name: 'Rice', exact: true }) })
      .innerText(),
    /Half/
  );
  pass('new food defaults to rough levels with the default Other category');
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem('pantry-organizer.demo.v1')).state
  );
  await page.getByRole('button', { name: 'Restock several', exact: true }).click();
  const rice = page
    .locator('.bulk-item')
    .filter({ has: page.getByRole('checkbox', { name: 'Rice Other', exact: true }) });
  await rice.getByRole('checkbox').check();
  await rice.locator('select[name^="quantity-"]').selectOption('1');
  const avocado = page.locator('.bulk-item').filter({ hasText: 'Avocados' });
  await avocado.getByRole('checkbox').check();
  await avocado.locator('input[name^="quantity-"]').fill('2');
  await page.getByRole('button', { name: 'Confirm restock', exact: true }).click();
  await page.locator('#editor').waitFor({ state: 'hidden' });
  const after = await page.evaluate(
    () => JSON.parse(localStorage.getItem('pantry-organizer.demo.v1')).state
  );
  const blueberryId = before.products.find((p) => p.name === 'Blueberries').id;
  assert.deepEqual(
    after.batches.filter((b) => b.productId === blueberryId),
    before.batches.filter((b) => b.productId === blueberryId)
  );
  assert.match(
    await page
      .locator('.card')
      .filter({ has: page.getByRole('heading', { name: 'Rice', exact: true }) })
      .innerText(),
    /Full/
  );
  assert.match(
    await page
      .locator('.card')
      .filter({ has: page.getByRole('heading', { name: 'Avocados', exact: true }) })
      .locator('.amount')
      .innerText(),
    /7 items/
  );
  pass('bulk restock saves selected, individually adjusted foods and leaves others untouched');
  const checked = after.batches.map((b) => b.checkedAt);
  await page.reload();
  await page.locator('.card').first().waitFor();
  assert.deepEqual(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('pantry-organizer.demo.v1')).state.batches.map(
        (b) => b.checkedAt
      )
    ),
    checked
  );
  pass('opening inventory does not mark foods freshly checked');
  await page.getByRole('button', { name: /Running low/ }).click();
  assert.equal(await page.locator('.card').count(), 1);
  pass('visible low-stock summary filters to remaining low food');
  await page.getByRole('button', { name: /Use soon/ }).click();
  assert.ok((await page.locator('.card').count()) > 0);
  pass('optional expiry summary finds upcoming package dates');
  await page.getByRole('button', { name: /Foods at home/ }).click();
  const staleCard = page
    .locator('.card')
    .filter({ has: page.getByRole('heading', { name: 'Rice', exact: true }) });
  await staleCard.getByRole('button', { name: 'Update stock for Rice' }).click();
  await page.locator('select[name^="quantity-"]').selectOption('0.25');
  const second = await page.context().newPage();
  await second.goto(baseUrl);
  const secondCard = second
    .locator('.card')
    .filter({ has: second.getByRole('heading', { name: 'Rice', exact: true }) });
  await secondCard.getByRole('button', { name: 'Update stock for Rice' }).click();
  await second.locator('select[name^="quantity-"]').selectOption('0.5');
  await second.getByRole('button', { name: 'Save changes', exact: true }).click();
  await second.locator('#editor').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  assert.match(await page.locator('dialog .error').innerText(), /Stock changed/);
  const savedLevel = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('pantry-organizer.demo.v1')).state;
    return s.batches.find((b) => b.productId === s.products.find((p) => p.name === 'Rice').id)
      .quantity;
  });
  assert.equal(savedLevel, 0.5);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await second.close();
  pass('stale open form cannot overwrite another tab’s stock check');
  const riceCard = page
    .locator('.card')
    .filter({ has: page.getByRole('heading', { name: 'Rice', exact: true }) });
  await riceCard.getByRole('button', { name: 'Add Rice to shopping list' }).click();
  await page.getByRole('button', { name: /Shopping list/ }).click();
  let riceRow = page
    .locator('.shopping-row')
    .filter({ has: page.getByRole('heading', { name: 'Rice', exact: true }) });
  await riceRow.waitFor();
  const beforeDelete = await page.evaluate(
    () => JSON.parse(localStorage.getItem('pantry-organizer.demo.v1')).state
  );
  const riceId = beforeDelete.products.find((p) => p.name === 'Rice').id;
  await page.getByRole('button', { name: 'My inventory' }).click();
  await page
    .locator('.card')
    .filter({ has: page.getByRole('heading', { name: 'Rice', exact: true }) })
    .getByRole('button', { name: 'Manage Rice' })
    .click();
  await page.getByRole('tab', { name: 'Details' }).click();
  await page.getByText('Delete this item', { exact: true }).click();
  await page.getByRole('button', { name: 'Continue to delete' }).click();
  await page.getByText('Delete Rice permanently?', { exact: true }).waitFor();
  assert.match(
    await page.locator('#editor').innerText(),
    /batches, activity history, and shopping-list entries/
  );
  await page.getByRole('button', { name: 'Keep item', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.locator('#editor').waitFor({ state: 'hidden' });
  assert.deepEqual(
    await page.evaluate(() => JSON.parse(localStorage.getItem('pantry-organizer.demo.v1')).state),
    beforeDelete
  );
  pass('canceling food deletion preserves pantry and linked shopping state');
  await page
    .locator('.card')
    .filter({ has: page.getByRole('heading', { name: 'Rice', exact: true }) })
    .getByRole('button', { name: 'Manage Rice' })
    .click();
  await page.getByRole('tab', { name: 'Details' }).click();
  await page.getByText('Delete this item', { exact: true }).click();
  await page.getByRole('button', { name: 'Continue to delete' }).click();
  await page.getByRole('button', { name: 'Delete food' }).click();
  await page.locator('#editor').waitFor({ state: 'hidden' });
  assert.equal(
    await page
      .locator('.card')
      .filter({ has: page.getByRole('heading', { name: 'Rice', exact: true }) })
      .count(),
    0
  );
  const deletedState = await page.evaluate(
    () => JSON.parse(localStorage.getItem('pantry-organizer.demo.v1')).state
  );
  assert.equal(
    deletedState.products.some((p) => p.id === riceId),
    false
  );
  assert.equal(
    deletedState.batches.some((b) => b.productId === riceId),
    false
  );
  assert.equal(
    deletedState.movements.some((m) => m.productId === riceId),
    false
  );
  assert.equal(
    deletedState.shopping.some((i) => i.productId === riceId),
    false
  );
  assert.ok(deletedState.products.some((p) => p.name === 'Avocados'));
  pass('confirmed food deletion removes only the selected food and dependent data');
  await page.getByRole('button', { name: /Shopping list/ }).click();
  assert.equal(
    await page
      .locator('.shopping-row')
      .filter({ has: page.getByRole('heading', { name: 'Rice', exact: true }) })
      .count(),
    0
  );
  pass('deleted food is removed from the shopping list');
  await page.getByRole('button', { name: 'My inventory' }).click();
  await page.setViewportSize({ width: 1280, height: 900 });
  assert.equal(
    await page.evaluate(() => getComputedStyle(document.querySelector('.toolbar')).display),
    'flex'
  );
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  pass('desktop toolbar preserves flex layout with no horizontal overflow');
  await page.getByRole('button', { name: 'Add food', exact: false }).click();
  const desktopModal = await page.locator('dialog[open]').evaluate((dialog) => ({
    width: dialog.getBoundingClientRect().width,
    categoryWidth: dialog.querySelector('[name="category-choice"]').getBoundingClientRect().width,
    scrollWidth: dialog.scrollWidth,
    clientWidth: dialog.clientWidth
  }));
  assert.ok(desktopModal.width > 400 && desktopModal.width <= 480);
  assert.ok(desktopModal.categoryWidth > 150);
  assert.ok(desktopModal.scrollWidth <= desktopModal.clientWidth);
  pass('Add modal category picker fits the desktop dialog');
  await page.locator('[name="name"]').fill('Bread flour');
  await page.getByLabel('Tracking').selectOption('lb');
  await page.locator('[name="quantity"]').fill('1');
  await page.locator('select[name="category-choice"]').selectOption('new');
  await page.locator('[name="category-custom"]').fill('  Grains & pulses  ');
  await page.getByRole('button', { name: 'Add food', exact: true }).click();
  await page.locator('#editor').waitFor({ state: 'hidden' });
  const flour = page
    .locator('.card')
    .filter({ has: page.getByRole('heading', { name: 'Bread flour', exact: true }) });
  assert.equal(await flour.locator('.amount').innerText(), '1 lb');
  assert.match(await flour.innerText(), /Grains & pulses/);
  assert.match(await flour.innerText(), /Pantry/);
  await page.setViewportSize({ width: 390, height: 844 });
  await flour.getByRole('button', { name: 'Manage Bread flour' }).click();
  await page.getByRole('tab', { name: 'Details' }).click();
  const editModal = page.locator('dialog[open]');
  assert.equal(
    await editModal.locator('select[name="category-choice"]').inputValue(),
    'existing:Grains%20%26%20pulses'
  );
  const editModalSize = await editModal.evaluate((dialog) => ({
    scrollWidth: dialog.scrollWidth,
    clientWidth: dialog.clientWidth
  }));
  assert.ok(editModalSize.scrollWidth <= editModalSize.clientWidth);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.locator('#editor').waitFor({ state: 'hidden' });
  assert.equal(
    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('pantry-organizer.demo.v1')).state;
      return state.products.find((product) => product.name === 'Bread flour').category;
    }),
    'Grains & pulses'
  );
  await flour.getByRole('button', { name: 'Manage Bread flour' }).click();
  await page.getByRole('tab', { name: 'Details' }).click();
  await page.locator('select[name="unit"]').selectOption('level');
  await page.getByRole('button', { name: 'Save changes' }).click();
  assert.equal(await page.getByRole('tab', { name: 'Stock' }).getAttribute('aria-selected'), 'true');
  assert.match(await page.evaluate(() => document.activeElement.id), /^manage-quantity-/);
  assert.equal(await page.locator('select[name^="quantity-"]').inputValue(), '');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  const unchangedFlour = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('pantry-organizer.demo.v1')).state;
    const product = state.products.find((item) => item.name === 'Bread flour');
    return { unit: product.unit, quantity: state.batches.find((batch) => batch.productId === product.id).quantity };
  });
  assert.deepEqual(unchangedFlour, { unit: 'lb', quantity: 1 });
  pass('hidden invalid batch reveals its Stock tab, focuses correction, and Cancel preserves exact lb stock');
  pass('pound tracking saves and displays one lb with category and location');
  await profileButton.click();
  await page.getByRole('menuitem', { name: 'Connect', exact: true }).click();
  await page.getByRole('heading', { name: 'Connect your shared pantry' }).waitFor();
  pass('missing backend configuration is clearly explained');
  const batchContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await batchContext.route('**/config.js', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: 'window.PANTRY_CONFIG = {};' })
  );
  const batchPage = await batchContext.newPage();
  await batchPage.goto(baseUrl);
  await batchPage.getByRole('button', { name: 'Try sample pantry' }).click();
  const fixture = await batchPage.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('pantry-organizer.demo.v1'));
    const product = data.state.products.find((food) => food.name === 'Blueberries');
    const firstBatch = data.state.batches.find((batch) => batch.productId === product.id);
    const extraLocation = firstBatch.location === 'Fridge' ? 'Pantry' : 'Fridge';
    data.state.batches.push({ ...firstBatch, id: 'fixture-blueberries-second', quantity: 3, location: extraLocation, expiry: '2026-10-20' });
    localStorage.setItem('pantry-organizer.demo.v1', JSON.stringify(data));
    return { extraLocation, batchId: 'fixture-blueberries-second' };
  });
  await batchPage.reload();
  const multiBatchCard = batchPage
    .locator('.shelf-card')
    .filter({ has: batchPage.getByRole('heading', { name: 'Blueberries', exact: true }) });
  assert.equal(await multiBatchCard.locator('.amount-update').count(), 0);
  assert.match(await multiBatchCard.locator('.amount').innerText(), /4 packs/);
  const batchDisclosure = multiBatchCard.locator('.batch-details');
  assert.equal(await batchDisclosure.evaluate((details) => details.open), false);
  assert.match(await batchDisclosure.locator('summary').innerText(), /2 batches/);
  assert.match(await batchDisclosure.locator('summary').innerText(), new RegExp(fixture.extraLocation));
  await batchDisclosure.locator('summary').click();
  const batchUpdateButtons = batchDisclosure.getByRole('button', { name: /Update stock for Blueberries in/ });
  assert.equal(await batchUpdateButtons.count(), 2);
  await batchDisclosure.getByRole('button', { name: `Update stock for Blueberries in ${fixture.extraLocation}` }).click();
  assert.equal(await batchPage.locator(`input[name="quantity-${fixture.batchId}"]`).inputValue(), '3');
  await batchPage.locator(`#manage-batch-${fixture.batchId} input[name="quantity-${fixture.batchId}"]`).fill('2');
  await batchPage.getByRole('button', { name: 'Save changes', exact: true }).click();
  await batchPage.locator('#editor').waitFor({ state: 'hidden' });
  assert.match(await multiBatchCard.locator('.amount').innerText(), /3 packs/);
  pass('multi-batch quantity aggregates once; collapsed location details expose batch-specific updates and save the selected batch');
  await batchContext.close();
  const authContext = await browser.newContext({ viewport: { width: 390, height: 844 } }),
    authPage = await authContext.newPage(),
    authErrors = [];
  let releaseSlowResponse;
  await authContext.route('**/api/category-suggestions', async (route) => {
    const request = route.request().postDataJSON();
    const item = request.items[0];
    if (item.name === 'Manual only') {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: '{"error":"Jev unavailable"}'
      });
      return;
    }
    if (item.name === 'Slow food') {
      await new Promise((resolve) => (releaseSlowResponse = resolve));
    }
    await route
      .fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          suggestions: request.items.map((entry) => ({
            id: entry.id,
            category: entry.name === 'Lentils' || entry.name === 'Black beans' ? 'Dals & beans' : 'Fruit',
            confidence: entry.name === 'Black beans' ? 0.55 : 0.94
          }))
        })
      })
      .catch(() => {});
  });
  authPage.on('pageerror', (e) => authErrors.push(e.message));
  await authContext.route('**/config.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: "window.PANTRY_CONFIG = {firebase:{apiKey:'test-key'},householdId:'our-pantry'};"
    })
  );
  await authContext.route('**/src/firebase.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `export class FirebaseRepository {
        static async resume(){ return null; }
        static async connect(){
          const initial = {state:{
            products:[
              {id:'beans',name:'Black beans',unit:'items',category:'Other',minimum:0,checkedAt:'2026-10-04'},
              {id:'lentils',name:'Lentils',unit:'items',category:'Other',minimum:0,checkedAt:'2026-10-04'}
            ],
            batches:[
              {id:'beans-batch',productId:'beans',quantity:2,location:'Pantry',expiry:null,checkedAt:'2026-10-04'},
              {id:'lentils-batch',productId:'lentils',quantity:1,location:'Pantry',expiry:null,checkedAt:'2026-10-04'}
            ],movements:[],shopping:[]},revision:1};
          window.__testPantry = initial;
          return {
            async getIdToken(){return 'test-id-token'},
            async load(){return window.__testPantry},
            async save(state,revision){
              if(revision!==window.__testPantry.revision) throw new Error('Pantry changed');
              window.__testPantry={state,revision:revision+1};
              return window.__testPantry;
            },
            subscribe(){return ()=>{}},async signOut(){}
          };
        }
      }`
    })
  );
  await authPage.goto('http://localhost:4173');
  await authPage.getByRole('button', { name: 'Profile' }).waitFor();
  await authPage.waitForTimeout(60);
  await authPage.getByRole('button', { name: 'Profile' }).press('ArrowDown');
  const authMenu = authPage.getByRole('menu', { name: 'Profile' });
  await authMenu.waitFor();
  assert.equal(await authMenu.getByRole('menuitem', { name: 'Sign in', exact: true }).count(), 1);
  await authMenu.getByRole('menuitem', { name: 'Sign in', exact: true }).click();
  await authPage.getByLabel('Email').fill('test@example.invalid');
  await authPage.getByLabel('Password').fill('test-only-password');
  await authPage.getByRole('button', { name: 'Sign in', exact: true }).click();
  await authPage.getByRole('button', { name: 'Profile' }).waitFor();
  await authPage.getByRole('button', { name: 'Profile' }).click();
  assert.match(
    await authPage.getByRole('status', { name: 'Connection status' }).innerText(),
    /Shared pantry connected/
  );
  assert.equal(
    await authPage
      .getByRole('menu', { name: 'Profile' })
      .getByRole('menuitem', { name: 'Sign out', exact: true })
      .count(),
    1
  );
  await authPage.getByRole('button', { name: 'Profile' }).press('Escape');
  await authPage.getByRole('button', { name: 'Add food', exact: false }).click();
  const signedInEditor = authPage.locator('#editor');
  await signedInEditor.locator('[name="name"]').fill('Peaches');
  await authPage.getByRole('button', { name: 'Suggest category with Jev' }).click();
  await signedInEditor.getByText(/Jev suggests/).waitFor();
  await signedInEditor.getByRole('button', { name: 'Use Fruit' }).click();
  assert.equal(
    await signedInEditor.locator('[name="category-choice"]').inputValue(),
    'existing:Fruit'
  );
  await signedInEditor.getByRole('button', { name: 'Add food', exact: true }).click();
  await signedInEditor.waitFor({ state: 'hidden' });
  assert.equal(
    await authPage.evaluate(
      () => window.__testPantry.state.products.find((food) => food.name === 'Peaches')?.category
    ),
    'Fruit'
  );
  pass('signed-in new-item Jev suggestion is explicitly accepted and saved');

  await authPage.getByRole('button', { name: 'Suggest categories' }).click();
  const reviewDialog = authPage.locator('#category-review');
  await reviewDialog.getByRole('heading', { name: 'Review category suggestions' }).waitFor();
  const reviewBounds = await reviewDialog.evaluate((dialog) => ({
    width: dialog.getBoundingClientRect().width,
    scrollWidth: dialog.scrollWidth,
    clientWidth: dialog.clientWidth
  }));
  assert.ok(reviewBounds.width <= 370 && reviewBounds.scrollWidth <= reviewBounds.clientWidth);
  const lowConfidence = reviewDialog.getByRole('checkbox', { name: 'Apply suggestion for Black beans' });
  assert.equal(await lowConfidence.evaluate((checkbox) => checkbox.checked), false);
  await reviewDialog.getByText('Review carefully · lower confidence').waitFor();
  await reviewDialog.getByRole('checkbox', { name: 'Apply suggestion for Black beans' }).uncheck();
  await reviewDialog
    .getByRole('combobox', { name: 'Category for Lentils' })
    .selectOption({ label: 'Rice & grains' });
  assert.equal(await reviewDialog.getByText(/changes selected/).innerText(), '1 of 2 changes selected');
  await reviewDialog.getByRole('button', { name: 'Apply 1 selected' }).click();
  await reviewDialog.waitFor({ state: 'hidden' });
  assert.deepEqual(
    await authPage.evaluate(() =>
      Object.fromEntries(
        window.__testPantry.state.products.map((food) => [food.name, food.category])
      )
    ),
    { 'Black beans': 'Other', Lentils: 'Rice & grains', Peaches: 'Fruit' }
  );
  pass(
    'phone review applies one checked, manually adjusted suggestion and leaves the other unchanged'
  );

  await authPage.getByRole('button', { name: 'Add food', exact: false }).click();
  await signedInEditor.locator('[name="name"]').fill('Manual only');
  await authPage.getByRole('button', { name: 'Suggest category with Jev' }).click();
  await signedInEditor.getByRole('status').filter({ hasText: 'Jev unavailable' }).waitFor();
  await signedInEditor
    .locator('[name="category-choice"]')
    .selectOption({ label: 'Ground spices & masalas' });
  await signedInEditor.getByRole('button', { name: 'Add food', exact: true }).click();
  await signedInEditor.waitFor({ state: 'hidden' });
  assert.equal(
    await authPage.evaluate(
      () => window.__testPantry.state.products.find((food) => food.name === 'Manual only')?.category
    ),
    'Ground spices & masalas'
  );
  pass('manual category selection and save remain available when Jev is unavailable');

  await authPage.getByRole('button', { name: 'Add food', exact: false }).click();
  await signedInEditor.locator('[name="name"]').fill('Slow food');
  await authPage.getByRole('button', { name: 'Suggest category with Jev' }).click();
  while (!releaseSlowResponse) await new Promise((resolve) => setTimeout(resolve, 5));
  await signedInEditor.locator('[name="name"]').fill('Changed name');
  releaseSlowResponse();
  await authPage.waitForTimeout(80);
  assert.equal(await signedInEditor.locator('.category-suggestion-result').count(), 0);
  await authPage.getByRole('button', { name: 'Cancel', exact: true }).click();
  await signedInEditor.waitFor({ state: 'hidden' });
  pass('late Jev response is ignored after the item name changes');

  await authPage.setViewportSize({ width: 1280, height: 900 });
  await authPage.getByRole('button', { name: 'Suggest categories' }).click();
  await reviewDialog.getByRole('heading', { name: 'Review category suggestions' }).waitFor();
  assert.ok((await reviewDialog.evaluate((dialog) => dialog.getBoundingClientRect().width)) <= 660);
  await reviewDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  pass('desktop category review dialog remains within its readable width');
  assert.deepEqual(authErrors, []);
  pass('profile menu shows signed-in state and Sign out while preserving the auth flow');
  await authContext.close();
  assert.deepEqual(errors, []);
  pass('no browser runtime errors');
} finally {
  await browser.close();
}
