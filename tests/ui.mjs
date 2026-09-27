import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright-core');
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
  await page.goto('http://localhost:4173');
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
  assert.equal(await cardActions.count(), 4);
  assert.deepEqual(
    await cardActions.evaluateAll((es) => es.map((e) => e.getAttribute('aria-label'))),
    [
      'Restock Avocados',
      'Edit settings for Avocados',
      'Delete Avocados',
      'Add Avocados to shopping list'
    ]
  );
  assert.deepEqual(
    await cardActions.evaluateAll((es) =>
      es.map((e) => e.querySelector('svg')?.getAttribute('aria-hidden'))
    ),
    ['true', 'true', 'true', 'true']
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
  await avocadoCard.getByRole('button', { name: 'Restock Avocados' }).click();
  await page.getByRole('heading', { name: 'Restock Avocados' }).waitFor();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  pass('restock icon opens the existing restock action');
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
  await card.getByRole('button', { name: 'Update Avocados batch' }).click();
  await page.locator('input[name="quantity"]').fill('0');
  await page.getByRole('button', { name: 'Save update', exact: true }).click();
  await page.locator('dialog').waitFor({ state: 'hidden' });
  assert.match(await card.innerText(), /Out of stock/);
  pass('check-in sets remaining quantity; out-of-stock food stays visible');
  await page.reload();
  card = page
    .locator('.card')
    .filter({ has: page.getByRole('heading', { name: 'Avocados', exact: true }) });
  await card.waitFor();
  assert.match(await card.innerText(), /Out of stock/);
  pass('stock persists across reload');
  await card.getByRole('button', { name: 'Add Avocados to shopping list' }).click();
  await page.getByRole('button', { name: /Shopping list/ }).click();
  let row = page
    .locator('.shopping-row')
    .filter({ has: page.getByRole('heading', { name: 'Avocados', exact: true }) });
  await row.getByRole('button', { name: 'Restock', exact: true }).click();
  await page.locator('input[name="quantity"]').fill('4');
  await page.getByRole('button', { name: 'Add to pantry', exact: true }).click();
  await page.locator('dialog').waitFor({ state: 'hidden' });
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
  await card.getByRole('button', { name: 'Edit settings for Avocados' }).click();
  await page.locator('[name="category"]').fill('Breakfast');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await page.locator('dialog').waitFor({ state: 'hidden' });
  await page.getByLabel('Food category').selectOption('Breakfast');
  assert.equal(await page.locator('.card').count(), 1);
  pass('custom category reassignment');
  await page.getByRole('button', { name: 'Add food', exact: false }).click();
  await page.locator('[name="name"]').fill('Rice');
  await page.locator('[name="quantity"]').selectOption('0.5');
  await page.getByRole('button', { name: 'Add food', exact: true }).click();
  await page.locator('dialog').waitFor({ state: 'hidden' });
  await page.getByLabel('Food category').selectOption('all');
  assert.match(
    await page
      .locator('.card')
      .filter({ has: page.getByRole('heading', { name: 'Rice', exact: true }) })
      .innerText(),
    /Half/
  );
  pass('new food defaults to rough levels');
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
  await page.locator('dialog').waitFor({ state: 'hidden' });
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
    /6 items/
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
  await staleCard.getByRole('button', { name: 'Update Rice batch' }).click();
  await page.locator('select[name="quantity"]').selectOption('0.25');
  const second = await page.context().newPage();
  await second.goto('http://localhost:4173');
  const secondCard = second
    .locator('.card')
    .filter({ has: second.getByRole('heading', { name: 'Rice', exact: true }) });
  await secondCard.getByRole('button', { name: 'Update Rice batch' }).click();
  await second.locator('select[name="quantity"]').selectOption('0.5');
  await second.getByRole('button', { name: 'Save update', exact: true }).click();
  await second.locator('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Save update', exact: true }).click();
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
    .getByRole('button', { name: 'Delete Rice' })
    .click();
  await page.getByRole('heading', { name: 'Delete Rice?' }).waitFor();
  assert.match(
    await page.locator('dialog').innerText(),
    /stock batches, activity history, and shopping-list entries/
  );
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.locator('dialog').waitFor({ state: 'hidden' });
  assert.deepEqual(
    await page.evaluate(() => JSON.parse(localStorage.getItem('pantry-organizer.demo.v1')).state),
    beforeDelete
  );
  pass('canceling food deletion preserves pantry and linked shopping state');
  await page
    .locator('.card')
    .filter({ has: page.getByRole('heading', { name: 'Rice', exact: true }) })
    .getByRole('button', { name: 'Delete Rice' })
    .click();
  await page.getByRole('button', { name: 'Delete food' }).click();
  await page.locator('dialog').waitFor({ state: 'hidden' });
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
  await profileButton.click();
  await page.getByRole('menuitem', { name: 'Connect', exact: true }).click();
  await page.getByRole('heading', { name: 'Connect your shared pantry' }).waitFor();
  pass('missing backend configuration is clearly explained');
  const authContext = await browser.newContext({ viewport: { width: 390, height: 844 } }),
    authPage = await authContext.newPage(),
    authErrors = [];
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
      body: 'export class FirebaseRepository{static async resume(){return null}static async connect(){return{async load(){return{state:{products:[],batches:[],movements:[],shopping:[]},revision:1}},subscribe(){},async signOut(){}}}}'
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
  assert.deepEqual(authErrors, []);
  pass('profile menu shows signed-in state and Sign out while preserving the auth flow');
  await authContext.close();
  assert.deepEqual(errors, []);
  pass('no browser runtime errors');
} finally {
  await browser.close();
}
