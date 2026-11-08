import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright-core');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const baseUrl = process.env.PANTRY_UI_URL || 'http://localhost:4173';
const storageKey = 'pantry-organizer.demo.v1';
const pass = (message) => console.log(`PASS ${message}`);
const screenshots = new URL('../.taste-skill/ux-after/', import.meta.url);
await mkdir(screenshots, { recursive: true });

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route('**/config.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'window.PANTRY_CONFIG = {};'
    })
  );
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const record = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
  await page.goto(baseUrl);
  await page.getByRole('button', { name: 'Add your first food', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Add food', exact: true });
  await editor.waitFor();
  await page.waitForFunction(() => document.activeElement?.getAttribute('name') === 'name');
  assert.deepEqual(
    await editor.locator('input, select').evaluateAll((fields) =>
      fields
        .filter((field) => field.checkVisibility())
        .map((field) => field.name)
        .sort()
    ),
    ['category-choice', 'location', 'name', 'quantity']
  );
  assert.equal(await editor.locator('.add-options').evaluate((details) => details.open), false);
  assert.equal(await editor.locator('[name="minimum"]').isVisible(), false);
  pass('first add has four visible fields, a named dialog and focus on the food name');

  for (const [width, height] of [
    [320, 500],
    [390, 500],
    [390, 844],
    [768, 1024],
    [1440, 900]
  ]) {
    await page.setViewportSize({ width, height });
    const bounds = await editor.locator('.add-footer').evaluate((footer) => ({
      top: footer.getBoundingClientRect().top,
      bottom: footer.getBoundingClientRect().bottom,
      overflow: document.documentElement.scrollWidth > innerWidth,
      buttons: [...footer.querySelectorAll('button')].map((button) => ({
        bottom: button.getBoundingClientRect().bottom,
        height: button.getBoundingClientRect().height
      }))
    }));
    assert.ok(bounds.top >= 0 && bounds.bottom <= height + 1);
    assert.equal(bounds.overflow, false);
    assert.ok(bounds.buttons.length > 0);
    assert.ok(bounds.buttons.every((button) => button.height >= 44 && button.bottom <= height + 1));
    await page.screenshot({ path: new URL(`add-${width}-${height}.png`, screenshots).pathname });
  }
  await page.setViewportSize({ width: 390, height: 500 });
  await editor.locator('.add-options > summary').click();
  await editor.getByLabel('Tracking').selectOption('items');
  assert.ok(
    await editor.locator('.add-body').evaluate((body) => body.scrollHeight > body.clientHeight)
  );
  assert.ok(
    await editor
      .locator('.add-footer')
      .evaluate((footer) => footer.getBoundingClientRect().bottom <= innerHeight + 1)
  );
  pass('save controls stay visible at short phone heights while optional settings scroll');

  await editor.getByLabel('Food name', { exact: true }).fill('Frozen edamame');
  await editor.locator('[name="quantity"]').fill('3');
  await editor.locator('[name="location"]').selectOption('Freezer');
  await editor.locator('[name="category-choice"]').selectOption({ label: 'Vegetables' });
  await editor.locator('[name="minimum"]').fill('5');
  await editor.locator('[name="expiry"]').fill('2030-02-11');
  const before = (await record())?.revision ?? 0;
  await editor.getByRole('button', { name: 'Add & add another', exact: true }).click();
  await editor.getByRole('status').filter({ hasText: 'Frozen edamame added' }).waitFor();
  await page.waitForFunction(() => document.activeElement?.getAttribute('name') === 'name');
  assert.equal(await editor.locator('[name="name"]').inputValue(), '');
  assert.equal(await editor.locator('[name="location"]').inputValue(), 'Freezer');
  assert.equal(
    await editor.locator('[name="category-choice"]').inputValue(),
    'existing:Vegetables'
  );
  assert.equal(await editor.locator('[name="unit"]').inputValue(), 'level');
  assert.equal(await editor.locator('[name="quantity"]').inputValue(), '1');
  assert.equal(await editor.locator('[name="expiry"]').inputValue(), '');
  assert.equal(await editor.locator('[name="minimum"]').isDisabled(), true);
  assert.equal(await editor.locator('.add-options').evaluate((details) => details.open), false);
  assert.equal((await record()).revision, before + 1);
  assert.equal(Number(await editor.getAttribute('data-revision')), before + 1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: new URL('add-next-phone.png', screenshots).pathname });
  await editor.getByLabel('Food name', { exact: true }).fill('Broccoli');
  await editor.locator('[name="quantity"]').selectOption('0.5');
  await editor.getByRole('button', { name: 'Add food', exact: true }).click();
  await editor.waitFor({ state: 'hidden' });
  let saved = await record();
  assert.equal(saved.revision, before + 2);
  assert.equal(saved.state.products.length, 2);
  const broccoli = saved.state.products.find((food) => food.name === 'Broccoli');
  const broccoliStock = saved.state.batches.find((batch) => batch.productId === broccoli.id);
  assert.equal(broccoli.unit, 'level');
  assert.equal(broccoliStock.quantity, 0.5);
  assert.equal(broccoliStock.location, 'Freezer');
  assert.equal(broccoliStock.expiry, null);
  await page.reload();
  await page.getByRole('heading', { name: 'Broccoli', exact: true }).waitFor();
  assert.deepEqual((await record()).state, saved.state);
  pass(
    'consecutive additions increment revision once each, retain location/category and reset per-food quantities/dates'
  );

  await page.getByRole('button', { name: 'Add food', exact: false }).click();
  await editor.getByLabel('Food name', { exact: true }).fill('Frozen edamame');
  await editor.getByText('Frozen edamame is already in your pantry', { exact: true }).waitFor();
  assert.match(await editor.locator('.existing-food').innerText(), /different tracking method/);
  await editor.getByRole('button', { name: 'Update existing food', exact: true }).click();
  await page
    .locator('#editor')
    .getByRole('heading', { name: 'Frozen edamame', exact: true })
    .waitFor();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.deepEqual((await record()).state, saved.state);
  pass(
    'existing foods are identified across tracking methods and can be updated without creating a duplicate'
  );

  await page.getByLabel('Food category').selectOption('Vegetables');
  await page.getByLabel('Storage location').selectOption('Fridge');
  await page.getByLabel('Search food').fill('  Couscous  ');
  await page.getByRole('button', { name: 'Add “Couscous”', exact: true }).click();
  assert.equal(await editor.getByLabel('Food name', { exact: true }).inputValue(), 'Couscous');
  assert.equal(await editor.locator('[name="location"]').inputValue(), 'Fridge');
  assert.equal(
    await editor.locator('[name="category-choice"]').inputValue(),
    'existing:Vegetables'
  );
  await editor.locator('[name="category-choice"]').selectOption({ label: 'Rice & grains' });
  await editor.getByRole('button', { name: 'Add food', exact: true }).click();
  await editor.waitFor({ state: 'hidden' });
  assert.equal(await page.getByLabel('Search food').inputValue(), '');
  assert.equal(await page.getByLabel('Storage location').inputValue(), 'all');
  assert.equal(await page.getByLabel('Food category').inputValue(), 'all');
  await page.getByRole('heading', { name: 'Couscous', exact: true }).waitFor();
  pass(
    'no-results add prefills the food name and clears filters after save so the new food is visible'
  );

  await page.getByLabel('Food category').selectOption('Vegetables');
  await page.getByLabel('Storage location').selectOption('Freezer');
  await page.getByLabel('Search food').fill(' broccoli ');
  assert.equal(await page.locator('.shelf-card').count(), 1);
  await page.locator('.toolbar').getByRole('button', { name: 'Clear filter', exact: true }).click();
  assert.equal(await page.locator('.shelf-card').count(), 3);
  await page.getByLabel('Search food').fill('Couscous');
  await page.getByRole('button', { name: /Running low/ }).click();
  assert.equal(await page.getByLabel('Search food').inputValue(), '');
  assert.equal(await page.locator('.shelf-card').count(), 1);
  await page
    .locator('.shelf-card')
    .getByRole('heading', { name: 'Frozen edamame', exact: true })
    .waitFor();
  pass(
    'search ignores accidental outer spaces; clear and summary filters restore a predictable scope'
  );

  await page.getByRole('button', { name: /Foods at home/ }).click();
  await page.evaluate((key) => {
    const data = JSON.parse(localStorage.getItem(key));
    const first = data.state.batches[0];
    first.expiry = new Date().toLocaleDateString('en-CA');
    data.state.batches.push({ ...first, id: 'due-batch-fixture', quantity: 1, location: 'Pantry' });
    data.revision += 1;
    localStorage.setItem(key, JSON.stringify(data));
  }, storageKey);
  await page.reload();
  await page.getByRole('button', { name: /Use soon/ }).waitFor();
  assert.equal(await page.locator('.stat[data-filter="soon"] strong').innerText(), '1');
  await page.getByRole('button', { name: /Use soon/ }).click();
  assert.equal(await page.locator('.shelf-card').count(), 1);
  pass('use-soon counts foods once even when two batches of the same food are due');

  await page.getByRole('button', { name: 'Add food', exact: false }).click();
  await editor.getByLabel('Food name', { exact: true }).fill('Oats');
  saved = await record();
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    window.__restorePantryStorage = () => {
      Storage.prototype.setItem = original;
    };
    Storage.prototype.setItem = function (itemKey, value) {
      if (itemKey === key) throw new Error('Test storage unavailable');
      return original.call(this, itemKey, value);
    };
  }, storageKey);
  await editor.getByRole('button', { name: 'Add & add another', exact: true }).click();
  await page.waitForFunction(() =>
    document.querySelector('.add-body [role="alert"]')?.textContent.trim()
  );
  assert.equal(await editor.getByLabel('Food name', { exact: true }).inputValue(), 'Oats');
  assert.equal(
    await editor.getByRole('button', { name: 'Add & add another', exact: true }).isEnabled(),
    true
  );
  assert.deepEqual(await record(), saved);
  await page.evaluate(() => window.__restorePantryStorage());
  await editor.getByRole('button', { name: 'Add food', exact: true }).click();
  await editor.waitFor({ state: 'hidden' });
  assert.equal((await record()).revision, saved.revision + 1);
  assert.equal((await record()).state.products.filter((food) => food.name === 'Oats').length, 1);
  assert.deepEqual(errors, []);
  pass('a failed save preserves the draft and pantry; retry saves exactly once');

  await page.getByRole('button', { name: 'Add food', exact: false }).click();
  await editor.getByLabel('Food name', { exact: true }).fill('Delayed save test');
  await page.evaluate(() => {
    const original = navigator.locks.request.bind(navigator.locks);
    navigator.locks.request = (name, callback) =>
      new Promise((resolve, reject) => {
        window.__releasePantrySave = () => original(name, callback).then(resolve, reject);
      });
  });
  await editor.getByRole('button', { name: 'Add food', exact: true }).click();
  await page.waitForFunction(() => typeof window.__releasePantrySave === 'function');
  await page.keyboard.press('Escape');
  assert.equal(await editor.isVisible(), true);
  assert.equal(
    await editor.getByLabel('Food name', { exact: true }).inputValue(),
    'Delayed save test'
  );
  await page.evaluate(() => window.__releasePantrySave());
  await editor.waitFor({ state: 'hidden' });
  assert.equal(
    (await record()).state.products.filter((food) => food.name === 'Delayed save test').length,
    1
  );
  pass('Escape cannot dismiss an editor while its save is pending');

  const otherTab = await context.newPage();
  await otherTab.goto(baseUrl);
  await page.getByRole('button', { name: 'Add food', exact: false }).click();
  await editor.getByLabel('Food name', { exact: true }).fill('Conflicting draft');
  await page.evaluate(() => {
    delete window.__releasePantrySave;
  });
  await editor.getByRole('button', { name: 'Add food', exact: true }).click();
  await page.waitForFunction(() => typeof window.__releasePantrySave === 'function');
  await otherTab.evaluate((key) => {
    const data = JSON.parse(localStorage.getItem(key));
    data.state.products[0].name = 'Updated in other tab';
    data.revision += 1;
    localStorage.setItem(key, JSON.stringify(data));
  }, storageKey);
  await page.waitForTimeout(100);
  await page.evaluate(() => window.__releasePantrySave());
  await editor.getByText(/Inventory changed in another tab/).waitFor();
  assert.equal(
    await editor.getByLabel('Food name', { exact: true }).inputValue(),
    'Conflicting draft'
  );
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('heading', { name: 'Updated in other tab', exact: true }).waitFor();
  await otherTab.close();
  pass('a conflicting save preserves the draft and refreshes changes from another tab');
  await context.close();
} finally {
  await browser.close();
}
