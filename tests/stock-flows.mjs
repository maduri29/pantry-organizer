import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as D from '../src/domain.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright-core');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const baseUrl = process.env.PANTRY_UI_URL || 'http://localhost:4173';
const key = 'pantry-organizer.demo.v1';
const pass = (message) => console.log(`PASS ${message}`);
const fixture = D.empty();
const exact = D.add(fixture, {
  name: 'Chickpeas',
  unit: 'items',
  category: 'Grains & pulses',
  quantity: 2,
  minimum: 1,
  location: 'Pantry',
  expiry: '2030-01-01'
});
D.add(fixture, { ...exact, quantity: 3, location: 'Freezer', expiry: '2031-02-02' });
const rough = D.add(fixture, {
  name: 'Olive oil',
  unit: 'level',
  category: 'Pantry staples',
  quantity: 0.25,
  minimum: 0.25,
  location: 'Pantry'
});
D.add(fixture, { ...rough, quantity: 0.5, location: 'Fridge' });
D.add(fixture, {
  name: 'Empty oats',
  unit: 'packs',
  category: 'Other',
  quantity: 1,
  location: 'Pantry'
});
const emptyBatch = fixture.batches.at(-1);
D.move(fixture, emptyBatch.id, 'correct', 0);
D.suggest(fixture, exact);
D.suggest(fixture, rough);

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route('**/config.js', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: 'window.PANTRY_CONFIG = {};' })
  );
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(baseUrl);
  await page.evaluate(
    ({ key, state }) => localStorage.setItem(key, JSON.stringify({ state, revision: 10 })),
    { key, state: fixture }
  );
  await page.reload();
  const record = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
  const editor = page.locator('#editor');
  const card = (name) =>
    page.locator('.shelf-card').filter({ has: page.getByRole('heading', { name, exact: true }) });
  const cancel = () => editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  const saved = () => editor.waitFor({ state: 'hidden' });
  const exactBatches = fixture.batches.filter((batch) => batch.productId === exact.id);

  await card('Chickpeas').getByRole('button', { name: 'Manage Chickpeas', exact: true }).click();
  await editor.locator('.stock-batch').first().waitFor();
  assert.equal(await editor.locator('.stock-batch').count(), 2);
  await editor.locator(`[name="quantity-${exactBatches[0].id}"]:visible`).fill('1');
  await editor.getByRole('button', { name: 'Save stock', exact: true }).click();
  await saved();
  let data = await record();
  assert.equal(data.revision, 11);
  assert.deepEqual(
    data.state.batches
      .filter((batch) => batch.productId === exact.id)
      .map(({ quantity, location, expiry }) => ({ quantity, location, expiry })),
    [
      { quantity: 1, location: 'Pantry', expiry: '2030-01-01' },
      { quantity: 3, location: 'Freezer', expiry: '2031-02-02' }
    ]
  );
  assert.equal(data.state.shopping.find((item) => item.productId === exact.id).status, 'open');
  pass(
    'stock check sets remaining amounts per batch and preserves dates, locations and the open shopping entry'
  );

  await card('Chickpeas').getByRole('button', { name: 'Manage Chickpeas', exact: true }).click();
  await editor
    .locator('.stock-batch')
    .first()
    .getByRole('button', { name: 'All used up', exact: true })
    .click();
  assert.equal(
    await editor.locator(`[name="quantity-${exactBatches[0].id}"]:visible`).inputValue(),
    '0'
  );
  await cancel();
  assert.equal((await record()).revision, 11);

  await card('Chickpeas').getByRole('button', { name: 'Manage Chickpeas', exact: true }).click();
  await page.locator('#editor').getByRole('button', { name: 'I bought more', exact: true }).click();
  assert.equal(await editor.locator('[name="location"]').inputValue(), 'Freezer');
  await editor.locator('[name="quantity"]').fill('1.5');
  await editor.locator('.stock-mode:not([hidden]) .stock-options > summary').click();
  await editor.locator('[name="expiry"]').fill('2032-03-03');
  await editor.getByRole('button', { name: 'What’s left', exact: true }).click();
  await editor.locator(`[name="quantity-${exactBatches[0].id}"]:visible`).fill('');
  if (!(await editor.getByRole('button', { name: 'I bought more', exact: true }).isVisible())) {
    await editor.getByRole('button', { name: 'What’s left', exact: true }).click();
  }
  await editor.getByRole('button', { name: 'I bought more', exact: true }).click();
  assert.equal(await editor.locator('[name="expiry"]').inputValue(), '2032-03-03');
  assert.equal(await editor.locator('[name="quantity"]').inputValue(), '1.5');
  await editor.getByRole('button', { name: 'Details', exact: true }).click();
  await editor.getByLabel('Food name', { exact: true }).fill('Draft chickpeas');
  if (!(await editor.getByRole('button', { name: 'I bought more', exact: true }).isVisible())) {
    await editor.getByRole('button', { name: 'What’s left', exact: true }).click();
  }
  await editor.getByRole('button', { name: 'I bought more', exact: true }).click();
  assert.equal(await editor.locator('[name="quantity"]').inputValue(), '1.5');
  await editor.getByRole('button', { name: 'Delete Chickpeas', exact: true }).click();
  assert.equal(
    await editor
      .getByRole('button', { name: 'Keep item' })
      .evaluate((el) => el === document.activeElement),
    true
  );
  await editor.getByRole('button', { name: 'Keep item' }).click();
  assert.equal(
    await editor.getByLabel('Food name', { exact: true }).inputValue(),
    'Draft chickpeas'
  );
  if (!(await editor.getByRole('button', { name: 'I bought more', exact: true }).isVisible())) {
    await editor.getByRole('button', { name: 'What’s left', exact: true }).click();
  }
  await editor.getByRole('button', { name: 'I bought more', exact: true }).click();
  assert.match(await editor.locator('.stock-list-note').innerText(), /checks this off/);
  await editor.getByRole('button', { name: 'Add to pantry', exact: true }).click();
  await saved();
  data = await record();
  assert.equal(data.revision, 12);
  assert.equal(D.total(data.state, exact), 5.5);
  assert.equal(data.state.batches.filter((batch) => batch.productId === exact.id).length, 3);
  assert.equal(data.state.batches.at(-1).expiry, '2032-03-03');
  assert.equal(data.state.shopping.find((item) => item.productId === exact.id).status, 'purchased');
  pass(
    'switching tasks retains purchase drafts; inactive blank fields do not block restock; exact stock and list completion save atomically'
  );

  await card('Olive oil').getByRole('button', { name: 'Manage Olive oil', exact: true }).click();
  await editor
    .locator('.stock-batch')
    .first()
    .getByRole('radio', { name: 'Out', exact: true })
    .check();
  await editor.getByRole('button', { name: 'Save stock', exact: true }).click();
  await saved();
  data = await record();
  assert.deepEqual(
    data.state.batches
      .filter((batch) => batch.productId === rough.id)
      .map((batch) => batch.quantity),
    [0, 0.5]
  );
  await card('Olive oil').getByRole('button', { name: 'Manage Olive oil', exact: true }).click();
  await page.locator('#editor').getByRole('button', { name: 'I bought more', exact: true }).click();
  await editor.locator('[name="location"]').selectOption('Pantry');
  assert.equal(await editor.getByRole('radio', { name: 'Out', exact: true }).count(), 0);
  await editor.getByRole('radio', { name: 'Full', exact: true }).check();
  await editor.getByRole('button', { name: 'Add to pantry', exact: true }).click();
  await saved();
  data = await record();
  assert.deepEqual(
    data.state.batches
      .filter((batch) => batch.productId === rough.id)
      .map((batch) => batch.quantity),
    [1, 0.5]
  );
  assert.equal(data.state.shopping.find((item) => item.productId === rough.id).status, 'purchased');
  pass(
    'rough restock replaces the selected location’s level and preserves stock in other locations'
  );

  await card('Empty oats').getByRole('button', { name: 'Manage Empty oats', exact: true }).click();
  await page.locator('#editor').getByRole('button', { name: 'I bought more', exact: true }).click();
  await editor.getByRole('button', { name: 'Increase packs', exact: true }).click();
  await editor.getByRole('button', { name: 'Add to pantry', exact: true }).click();
  await saved();
  assert.match(await card('Empty oats').locator('.amount').innerText(), /2 packs/);
  pass('out-of-stock foods can be restocked directly with quantity controls');

  await page.getByRole('button', { name: 'Restock several', exact: true }).click();
  const confirm = editor.getByRole('button', { name: 'Confirm restock', exact: true });
  assert.equal(await confirm.isDisabled(), true);
  assert.equal(await editor.locator('.trip-fields:visible').count(), 0);
  const chickpeas = editor.locator('.bulk-item').filter({ hasText: 'Chickpeas' });
  await chickpeas.getByRole('checkbox').check();
  await chickpeas.locator('input[type=number]').fill('');
  await editor.getByLabel('Find foods to restock').fill('oats');
  await confirm.click();
  assert.equal(await editor.getByLabel('Find foods to restock').inputValue(), '');
  assert.equal(
    await chickpeas
      .locator('input[type=number]')
      .evaluate((field) => field === document.activeElement),
    true
  );
  await chickpeas.locator('input[type=number]').fill('2');
  await editor.getByLabel('Find foods to restock').fill('oats');
  const oats = editor.locator('.bulk-item').filter({ hasText: 'Empty oats' });
  await oats.getByRole('checkbox').check();
  await oats.getByRole('checkbox').uncheck();
  const beforeTrip = await record();
  await confirm.click();
  await saved();
  data = await record();
  assert.equal(data.revision, beforeTrip.revision + 1);
  assert.equal(D.total(data.state, exact), 7.5);
  assert.deepEqual(
    data.state.batches.filter((batch) => batch.productId === emptyBatch.productId),
    beforeTrip.state.batches.filter((batch) => batch.productId === emptyBatch.productId)
  );
  pass(
    'grocery trip reveals only selected fields, finds hidden invalid amounts and saves selected foods across searches once'
  );

  await card('Chickpeas').getByRole('button', { name: 'Manage Chickpeas', exact: true }).click();
  await page.locator('#editor').getByRole('button', { name: 'I bought more', exact: true }).click();
  await editor.locator('[name="quantity"]').fill('3');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.restorePantryStorage = () => {
      Storage.prototype.setItem = original;
    };
    Storage.prototype.setItem = function (key, value) {
      if (key === 'pantry-organizer.demo.v1') throw new Error('Storage full');
      return original.call(this, key, value);
    };
  });
  const beforeFailure = await record();
  await editor.getByRole('button', { name: 'Add to pantry', exact: true }).click();
  await editor.getByRole('alert').waitFor();
  assert.equal(await editor.locator('[name="quantity"]').inputValue(), '3');
  assert.deepEqual(await record(), beforeFailure);
  await page.evaluate(() => window.restorePantryStorage());
  await editor.getByRole('button', { name: 'Add to pantry', exact: true }).click();
  await saved();
  data = await record();
  assert.equal(data.revision, beforeFailure.revision + 1);
  assert.equal(D.total(data.state, exact), 10.5);
  pass('failed restock preserves the purchase draft and retry adds it exactly once');

  for (const [width, height] of [
    [320, 480],
    [390, 500],
    [768, 700],
    [1440, 900]
  ]) {
    await page.setViewportSize({ width, height });
    await card('Olive oil').getByRole('button', { name: 'Manage Olive oil', exact: true }).click();
    await page
      .locator('#editor')
      .getByRole('button', { name: 'I bought more', exact: true })
      .click();
    await editor.locator('.stock-mode:not([hidden]) .stock-options > summary').click();
    const layout = await editor.evaluate((dialog) => ({
      bottom: dialog.querySelector('.stock-footer').getBoundingClientRect().bottom,
      overflow: dialog.scrollWidth > dialog.clientWidth,
      buttons: [...dialog.querySelectorAll('.stock-footer button')].map(
        (button) => button.getBoundingClientRect().height
      )
    }));
    assert.ok(layout.bottom <= height + 1);
    assert.equal(layout.overflow, false);
    assert.ok(layout.buttons.every((height) => height >= 44));
    await cancel();
  }
  pass('save actions remain visible at short phone, tablet and desktop sizes');
  assert.deepEqual(errors, []);
  await context.close();
} finally {
  await browser.close();
}
